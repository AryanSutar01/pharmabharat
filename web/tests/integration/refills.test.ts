import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Customer } from "@/lib/models/customer";
import { Membership } from "@/lib/models/membership";
import { Notification } from "@/lib/models/notification";
import { Product } from "@/lib/models/product";
import { RefillNudge } from "@/lib/models/refill";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { createBill } from "@/lib/retail/billing";
import { createCustomer } from "@/lib/retail/customers";
import { dueRefills, markContacted, runRefillReminders } from "@/lib/retail/refills";
import { addStock } from "@/lib/retail/stock";

const DAY = 24 * 3600 * 1000;
const USER = { id: "refill-owner", name: "Owner" };

describe("refill reminders (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let metformin: mongoose.Types.ObjectId;
  let vitamin: mongoose.Types.ObjectId;
  let metStock: string;
  let vitStock: string;
  let asha: mongoose.Types.ObjectId; // agreed to email reminders
  let ravi: mongoose.Types.ObjectId; // no email — for the call-list

  /** Sells `stockId` to `customerId` on each of the given days-ago. */
  async function sellOn(stockId: string, customerId: mongoose.Types.ObjectId, daysAgo: number[]) {
    for (const days of daysAgo) {
      const bill = await createBill(shop._id, { lines: [{ stockId, qty: 1 }], customerId: String(customerId) }, USER);
      await Bill.collection.updateOne({ _id: bill._id }, { $set: { createdAt: new Date(Date.now() - days * DAY) } });
    }
  }

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all(
      [Bill, Business, Customer, Membership, Notification, Product, RefillNudge, ShopStock, ShopItem].map((m) =>
        m.createCollection(),
      ),
    );
    await Customer.syncIndexes();

    const b = await Business.create({
      type: "retailer",
      legalName: "Refill Pharmacy",
      ownerUserId: USER.id,
      phone: "02012345678",
      address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
      kyc: { status: "approved" },
    });
    shop = b.toObject() as BusinessDoc;
    await Membership.create({ businessId: shop._id, userId: USER.id, role: "owner", status: "active" });

    const [p1, p2] = await Product.create([
      { name: "Metformin 500 Tablet", manufacturer: "Test Labs", mrp: 105, source: "seller" },
      { name: "Vitamin D3 Sachet", manufacturer: "Test Labs", mrp: 210, source: "seller" },
    ]);
    metformin = p1._id;
    vitamin = p2._id;

    for (const [productId, name, batchNo, qty] of [
      [metformin, "Metformin 500 Tablet", "MF-1", 100],
      [vitamin, "Vitamin D3 Sachet", "VT-1", 20],
    ] as const) {
      await addStock(
        shop._id,
        { productId, name, batchNo, expiryDate: new Date(Date.now() + 400 * DAY), qty, cost: 80, mrp: 105, gstRate: 5 },
        USER.id,
      );
    }
    const stocks = await ShopStock.find({ businessId: shop._id }).lean();
    metStock = String(stocks.find((s) => s.batchNo === "MF-1")!._id);
    vitStock = String(stocks.find((s) => s.batchNo === "VT-1")!._id);

    const a = await createCustomer(
      shop._id,
      { name: "Asha Patil", phone: "9876543210", email: "asha@example.com", consent: true, reminders: true },
      USER.id,
    );
    asha = a.customer._id;
    const r = await createCustomer(shop._id, { name: "Ravi Kumar", phone: "9800000001", consent: true }, USER.id);
    ravi = r.customer._id;

    // Asha buys metformin every 28 days; the last one was 29 days ago, so she is due.
    await sellOn(metStock, asha, [85, 57, 29]);
    // Ravi buys the same way but has no email, so he goes on the call-list.
    await sellOn(vitStock, ravi, [60, 30]);
    // A one-off purchase must never produce a reminder.
    await sellOn(metStock, ravi, [10]);
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("works out who is due from their own purchase gaps", async () => {
    const rows = await dueRefills(shop._id);
    expect(rows).toHaveLength(2);

    const ashaRow = rows.find((r) => r.customerId === String(asha))!;
    expect(ashaRow).toMatchObject({ productName: "Metformin 500 Tablet", gapDays: 28, reminders: true, daysLate: 1 });
    expect(ashaRow.inStock).toBeGreaterThan(0);

    const raviRow = rows.find((r) => r.customerId === String(ravi))!;
    expect(raviRow).toMatchObject({ productName: "Vitamin D3 Sachet", gapDays: 30, reminders: false, daysLate: 0 });

    // Ravi's single metformin purchase is not a pattern.
    expect(rows.some((r) => r.customerId === String(ravi) && r.productName.startsWith("Metformin"))).toBe(false);
  });

  it("emails only the customers who agreed, and only once per cycle", async () => {
    const run = await runRefillReminders(shop._id);
    expect(run).toMatchObject({ due: 2, emailed: 1, toCall: 1 });

    const nudges = await RefillNudge.find({ businessId: shop._id }).lean();
    expect(nudges).toHaveLength(1);
    expect(String(nudges[0].customerId)).toBe(String(asha));
    expect(nudges[0].emailedAt).toBeTruthy();

    // A second run the same day sends nothing new.
    expect((await runRefillReminders(shop._id)).emailed).toBe(0);
    expect(await Notification.countDocuments({ businessId: shop._id, kind: "shop_refills" })).toBe(2);
  });

  it("flags a repeat medicine that is not on the shelf", async () => {
    await ShopStock.updateOne({ _id: vitStock }, { $set: { qty: 0 } });
    const rows = await dueRefills(shop._id);
    expect(rows.find((r) => r.customerId === String(ravi))!.inStock).toBe(0);
    expect((await runRefillReminders(shop._id)).outOfStock).toBe(1);
  });

  it("drops someone off the call-list once the counter has rung them", async () => {
    const before = (await dueRefills(shop._id)).find((r) => r.customerId === String(ravi))!;
    await markContacted(shop._id, { customerId: before.customerId, productId: before.productId, dueOn: before.dueOn }, USER.id);

    const after = (await dueRefills(shop._id)).find((r) => r.customerId === String(ravi))!;
    expect(after.contactedAt).toBeTruthy();
    expect((await runRefillReminders(shop._id)).toCall).toBe(0);
  });
});
