import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Customer } from "@/lib/models/customer";
import { Product } from "@/lib/models/product";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { BillingError, createBill, dayTotals, listBills, searchShelf } from "@/lib/retail/billing";
import { createCustomer } from "@/lib/retail/customers";
import { addStock } from "@/lib/retail/stock";

const DAY = 24 * 3600 * 1000;
const USER = { id: "counter-staff", name: "Counter Staff" };

describe("billing counter (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let dolo: mongoose.Types.ObjectId;
  let syrup: mongoose.Types.ObjectId;
  let oldBatch: string;
  let newBatch: string;
  let syrupBatch: string;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all([Bill, Business, Customer, Product, ShopStock, ShopItem].map((m) => m.createCollection()));

    const b = await Business.create({
      type: "retailer",
      legalName: "Counter Pharmacy",
      ownerUserId: "counter-owner",
      address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
      kyc: { status: "approved" },
    });
    shop = b.toObject() as BusinessDoc;

    const [p1, p2] = await Product.create([
      { name: "Dolo 650 Tablet", manufacturer: "Micro Labs", packSizeLabel: "strip of 15", mrp: 105, source: "seller" },
      { name: "Benadryl Syrup", manufacturer: "J&J", packSizeLabel: "100 ml", mrp: 200, source: "seller" },
    ]);
    dolo = p1._id;
    syrup = p2._id;

    // Two batches of the same medicine: one expiring sooner, and dearer.
    await addStock(
      shop._id,
      { productId: dolo, name: "Dolo 650 Tablet", packSizeLabel: "strip of 15", batchNo: "OLD-1", expiryDate: new Date(Date.now() + 120 * DAY), qty: 3, cost: 80, mrp: 105, gstRate: 5, schedule: "otc" },
      USER.id,
    );
    await addStock(
      shop._id,
      { productId: dolo, name: "Dolo 650 Tablet", packSizeLabel: "strip of 15", batchNo: "NEW-1", expiryDate: new Date(Date.now() + 500 * DAY), qty: 10, cost: 82, mrp: 105, gstRate: 5, schedule: "otc" },
      USER.id,
    );
    // Expiring inside a month: must never reach the counter.
    await addStock(
      shop._id,
      { productId: dolo, name: "Dolo 650 Tablet", batchNo: "DEAD-1", expiryDate: new Date(Date.now() + 10 * DAY), qty: 5, cost: 80, mrp: 105, gstRate: 5 },
      USER.id,
    );
    await addStock(
      shop._id,
      { productId: syrup, name: "Benadryl Syrup", packSizeLabel: "100 ml", batchNo: "SY-1", expiryDate: new Date(Date.now() + 300 * DAY), qty: 4, cost: 150, mrp: 200, gstRate: 12, schedule: "h" },
      USER.id,
    );

    const ids = await ShopStock.find({ businessId: shop._id }, { batchNo: 1 }).lean();
    const byBatch = new Map(ids.map((s) => [s.batchNo, String(s._id)]));
    oldBatch = byBatch.get("OLD-1")!;
    newBatch = byBatch.get("NEW-1")!;
    syrupBatch = byBatch.get("SY-1")!;
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("offers the batch that expires first, and hides short-dated stock", async () => {
    const hits = await searchShelf(shop._id, "dolo");
    expect(hits).toHaveLength(1);
    expect(hits[0].batches.map((b) => b.batchNo)).toEqual(["OLD-1", "NEW-1"]);
    expect(hits[0].totalQty).toBe(13); // DEAD-1 excluded
  });

  it("bills, works GST out of the MRP, and takes the stock off the shelf", async () => {
    const bill = await createBill(
      shop._id,
      {
        lines: [
          { stockId: oldBatch, qty: 2 },
          { stockId: syrupBatch, qty: 1, discountPercent: 10 },
        ],
        payment: { mode: "upi" },
        prescription: { doctorName: "Dr A Sharma", registrationNo: "MH-12345" },
      },
      USER,
    );

    expect(bill.billNo).toMatch(/^\d{4}-\d{2}\/00001$/);
    // 2 × ₹105 = ₹210 at 5%, plus ₹200 − 10% = ₹180 at 12% → ₹390
    expect(bill.totals?.grandTotal).toBe(390);
    expect(bill.totals?.taxable).toBe(360.71);
    // The odd paisa on the 12% line falls to CGST; the pair still sums to the tax.
    expect(bill.totals?.cgst).toBe(14.65);
    expect(bill.totals?.sgst).toBe(14.64);
    expect((bill.totals?.taxable ?? 0) + (bill.totals?.tax ?? 0)).toBe(390);
    expect(bill.costTotal).toBe(310); // 2 × 80 + 150
    expect(bill.prescription?.doctorName).toBe("Dr A Sharma");

    expect((await ShopStock.findById(oldBatch).lean())!.qty).toBe(1);
    expect((await ShopStock.findById(syrupBatch).lean())!.qty).toBe(3);
    expect((await ShopItem.findOne({ businessId: shop._id, productId: dolo }).lean())!.lastSoldAt).toBeTruthy();
  });

  it("refuses more than is on the shelf, and changes nothing when it does", async () => {
    await expect(createBill(shop._id, { lines: [{ stockId: oldBatch, qty: 5 }] }, USER)).rejects.toBeInstanceOf(BillingError);
    expect((await ShopStock.findById(oldBatch).lean())!.qty).toBe(1);

    // A bill that is only partly fulfillable must leave the whole shelf alone.
    await expect(
      createBill(shop._id, { lines: [{ stockId: newBatch, qty: 2 }, { stockId: oldBatch, qty: 99 }] }, USER),
    ).rejects.toMatchObject({ code: "out_of_stock" });
    expect((await ShopStock.findById(newBatch).lean())!.qty).toBe(10);
    expect(await Bill.countDocuments({ businessId: shop._id })).toBe(1);
  });

  it("records the visit against a customer and numbers bills in sequence", async () => {
    const { customer } = await createCustomer(
      shop._id,
      { name: "Asha Patil", phone: "9876543210", consent: true, reminders: true, conditions: ["diabetes"] },
      USER.id,
    );
    const bill = await createBill(
      shop._id,
      { lines: [{ stockId: newBatch, qty: 1 }], customerId: String(customer._id), payment: { mode: "cash" } },
      USER,
    );
    expect(bill.billNo).toMatch(/\/00002$/);
    expect(bill.customer?.name).toBe("Asha Patil");

    const after = await Customer.findById(customer._id).lean();
    expect(after).toMatchObject({ visits: 1, totalSpend: 105 });
    expect(after!.lastVisitAt).toBeTruthy();
    expect(after!.consent).toMatchObject({ given: true, reminders: true, version: "1" });
  });

  it("does not create a second record for a phone number already known", async () => {
    const again = await createCustomer(shop._id, { name: "Asha P", phone: "9876543210", consent: true }, USER.id);
    expect(again.created).toBe(false);
    expect(await Customer.countDocuments({ businessId: shop._id })).toBe(1);
  });

  it("totals the day's takings and margin", async () => {
    const from = new Date(Date.now() - DAY);
    const totals = await dayTotals(shop._id, from, new Date(Date.now() + DAY));
    expect(totals).toMatchObject({ bills: 2, sales: 495 }); // 390 + 105
    expect(totals.margin).toBe(103); // 495 − (310 + 82)
    expect(await listBills(shop._id)).toHaveLength(2);
  });
});
