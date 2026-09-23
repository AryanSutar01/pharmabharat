import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Customer } from "@/lib/models/customer";
import { Product } from "@/lib/models/product";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { ShopSettings } from "@/lib/models/shop-settings";
import { createBill } from "@/lib/retail/billing";
import {
  anonymiseCustomer,
  createCustomer,
  customerPurchases,
  customerStats,
  customerSummary,
  listCustomers,
  purgeInactiveCustomers,
  updateCustomer,
} from "@/lib/retail/customers";
import { addStock } from "@/lib/retail/stock";

const DAY = 24 * 3600 * 1000;
const USER = { id: "book-staff", name: "Counter Staff" };

describe("customer book (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let stockId: string;
  let asha: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all(
      [Bill, Business, Customer, Product, ShopStock, ShopItem, ShopSettings].map((m) => m.createCollection()),
    );

    await Customer.syncIndexes();

    const b = await Business.create({
      type: "retailer",
      legalName: "Book Pharmacy",
      ownerUserId: "book-owner",
      address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
      kyc: { status: "approved" },
    });
    shop = b.toObject() as BusinessDoc;

    const p = await Product.create({ name: "Metformin 500 Tablet", manufacturer: "Test Labs", mrp: 105, source: "seller" });
    await addStock(
      shop._id,
      { productId: p._id, name: "Metformin 500 Tablet", batchNo: "MF-1", expiryDate: new Date(Date.now() + 400 * DAY), qty: 100, cost: 80, mrp: 105, gstRate: 5 },
      USER.id,
    );
    stockId = String((await ShopStock.findOne({ businessId: shop._id }).lean())!._id);

    const { customer } = await createCustomer(
      shop._id,
      { name: "Asha Patil", phone: "9876543210", email: "asha@example.com", consent: true, reminders: true, conditions: ["diabetes"] },
      USER.id,
    );
    asha = customer._id;
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("finds customers by filter and counts the book", async () => {
    await createCustomer(shop._id, { name: "Ravi Kumar", phone: "9800000001", consent: true }, USER.id);
    expect(await customerStats(shop._id)).toMatchObject({ total: 2, chronic: 1, reminders: 1, lapsed: 0 });

    const chronic = await listCustomers(shop._id, { filter: "chronic" });
    expect(chronic.map((c) => c.name)).toEqual(["Asha Patil"]);
    expect((await listCustomers(shop._id, { q: "98000" })).map((c) => c.name)).toEqual(["Ravi Kumar"]);
  });

  it("works out what a customer buys regularly from their own bills", async () => {
    // Three purchases, roughly four weeks apart.
    for (const daysAgo of [60, 32, 4]) {
      const bill = await createBill(shop._id, { lines: [{ stockId, qty: 1 }], customerId: String(asha) }, USER);
      // createdAt is immutable under mongoose timestamps, so backdate through the driver.
      await Bill.collection.updateOne({ _id: bill._id }, { $set: { createdAt: new Date(Date.now() - daysAgo * DAY) } });
    }
    const rows = await customerPurchases(shop._id, String(asha));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Metformin 500 Tablet", times: 3, packs: 3, medianGapDays: 28 });

    const summary = await customerSummary(shop._id, String(asha));
    expect(summary).toMatchObject({ bills: 3, spend: 315, average: 105 });
  });

  it("keeps the original consent date when details are edited", async () => {
    const before = await Customer.findById(asha).lean();
    const updated = await updateCustomer(shop._id, String(asha), {
      name: "Asha S Patil",
      phone: "9876543210",
      consent: true,
      reminders: false,
      conditions: ["diabetes", "hypertension"],
    });
    expect(updated).toMatchObject({ name: "Asha S Patil" });
    expect(updated!.consent?.at).toEqual(before!.consent?.at);
    expect(updated!.consent?.reminders).toBe(false); // reminder consent withdrawn
  });

  it("erases personal details on request but keeps the bills", async () => {
    expect(await anonymiseCustomer(shop._id, String(asha))).toBe(true);
    const after = await Customer.findById(asha).lean();
    expect(after).toMatchObject({ name: "Deleted customer", status: "anonymised", conditions: [] });
    expect(after!.phone).toBeUndefined();
    expect(after!.email).toBeUndefined();

    const bills = await Bill.find({ businessId: shop._id, customerId: asha }).lean();
    expect(bills).toHaveLength(3); // accounting records survive
    expect(bills.every((b) => !b.customer?.name && !b.customer?.phone)).toBe(true);
    expect(bills[0].totals?.grandTotal).toBe(105);

    // Erased customers drop out of the book.
    expect(await customerStats(shop._id)).toMatchObject({ total: 1 });
  });

  it("purges customers who stopped coming longer ago than the retention window", async () => {
    await ShopSettings.updateOne({ businessId: shop._id }, { $set: { retentionMonths: 6 } }, { upsert: true });
    const { customer } = await createCustomer(shop._id, { name: "Old Customer", phone: "9800000002", consent: true }, USER.id);
    await Customer.updateOne({ _id: customer._id }, { $set: { lastVisitAt: new Date(Date.now() - 400 * DAY) } });

    expect(await purgeInactiveCustomers(shop._id)).toBe(1);
    expect((await Customer.findById(customer._id).lean())!.status).toBe("anonymised");
    // The recent customer is untouched.
    expect((await listCustomers(shop._id)).map((c) => c.name)).toEqual(["Ravi Kumar"]);
  });
});
