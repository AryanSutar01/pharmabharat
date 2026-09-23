import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Customer } from "@/lib/models/customer";
import { Product } from "@/lib/models/product";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { createBill } from "@/lib/retail/billing";
import { createCustomer } from "@/lib/retail/customers";
import { shopReport } from "@/lib/retail/reports";
import { addStock } from "@/lib/retail/stock";

const DAY = 24 * 3600 * 1000;
const USER = { id: "rep-staff", name: "Counter Staff" };

describe("shop reports (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let brisk: string;
  let asha: mongoose.Types.ObjectId;

  /** Sells and then backdates the bill, so the report windows can be exercised. */
  async function sell(stockId: string, qty: number, daysAgo: number, customerId?: mongoose.Types.ObjectId) {
    const bill = await createBill(
      shop._id,
      { lines: [{ stockId, qty }], ...(customerId ? { customerId: String(customerId) } : {}) },
      USER,
    );
    await Bill.collection.updateOne({ _id: bill._id }, { $set: { createdAt: new Date(Date.now() - daysAgo * DAY) } });
    return bill;
  }

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all([Bill, Business, Customer, Product, ShopStock, ShopItem].map((m) => m.createCollection()));

    const b = await Business.create({
      type: "retailer",
      legalName: "Report Pharmacy",
      ownerUserId: "rep-owner",
      address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
      kyc: { status: "approved" },
    });
    shop = b.toObject() as BusinessDoc;

    const [p1, p2, p3] = await Product.create([
      { name: "Brisk 100 Tablet", manufacturer: "Test Labs", mrp: 105, source: "seller" },
      { name: "Quiet 200 Tablet", manufacturer: "Test Labs", mrp: 210, source: "seller" },
      { name: "Lapsed 300 Tablet", manufacturer: "Test Labs", mrp: 105, source: "seller" },
    ]);
    for (const [productId, name, batchNo, qty, cost, mrp, gst, expiryDays] of [
      [p1._id, "Brisk 100 Tablet", "BR-1", 200, 80, 105, 5, 400],
      [p2._id, "Quiet 200 Tablet", "QT-1", 20, 150, 210, 12, 400],
      [p3._id, "Lapsed 300 Tablet", "LP-1", 6, 90, 105, 5, -3], // expired a few days ago
    ] as const) {
      await addStock(
        shop._id,
        { productId, name, batchNo, expiryDate: new Date(Date.now() + expiryDays * DAY), qty, cost, mrp, gstRate: gst },
        USER.id,
      );
    }
    const stocks = await ShopStock.find({ businessId: shop._id }).lean();
    brisk = String(stocks.find((s) => s.batchNo === "BR-1")!._id);

    const { customer } = await createCustomer(shop._id, { name: "Asha Patil", phone: "9876543210", consent: true }, USER.id);
    asha = customer._id;

    // This period: 10 packs of the brisk mover, one linked to a customer.
    await sell(brisk, 6, 5, asha);
    await sell(brisk, 4, 12);
    // The period before: 4 packs, so sales should show as up.
    await sell(brisk, 4, 40);
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("compares sales and margin with the period before", async () => {
    const r = await shopReport(shop._id, new Date(), 30);
    // 10 × ₹105 = ₹1,050 this period against 4 × ₹105 = ₹420 before.
    expect(r.sales).toMatchObject({ current: 1050, previous: 420 });
    expect(r.sales.change).toBe(150);
    expect(r.margin.current).toBe(250); // 1050 − 10 × 80
    expect(r.marginPercent).toBe(23.8);
    expect(r.bills.current).toBe(2);
    expect(r.averageBill.current).toBe(525);
  });

  it("buckets sales by day for the chart", async () => {
    const r = await shopReport(shop._id, new Date(), 30);
    expect(r.daily).toHaveLength(30);
    expect(r.daily.reduce((a, d) => a + d.value, 0)).toBe(1050);
    expect(r.daily.filter((d) => d.value > 0)).toHaveLength(2);
  });

  it("ranks movers and names what never sold", async () => {
    const r = await shopReport(shop._id, new Date(), 30);
    expect(r.topSellers.map((s) => s.label)).toEqual(["Brisk 100 Tablet"]);
    expect(r.topMargin[0]).toMatchObject({ label: "Brisk 100 Tablet", value: 250 });

    // The quiet mover is in date, on the shelf, and has never sold.
    expect(r.deadStock.map((d) => d.name)).toEqual(["Quiet 200 Tablet"]);
    expect(r.deadStockValue).toBe(3000); // 20 × ₹150
  });

  it("counts new against returning customers", async () => {
    const r = await shopReport(shop._id, new Date(), 30);
    expect(r.customers).toMatchObject({ newCount: 1, repeatCount: 0, total: 1 });
    expect(r.customers.top[0]).toMatchObject({ label: "Asha Patil", value: 630 });
  });

  it("values what expired and totals the GST collected", async () => {
    const r = await shopReport(shop._id, new Date(), 30);
    expect(r.expiryLoss).toMatchObject({ count: 1, value: 540 }); // 6 × ₹90

    // All sales were at 5%: ₹1,050 inclusive → ₹1,000 taxable, ₹25 + ₹25.
    expect(r.gst).toHaveLength(1);
    expect(r.gst[0]).toMatchObject({ rate: 5, taxable: 1000, cgst: 25, sgst: 25 });
  });

  it("widens to the longer window when asked", async () => {
    const r = await shopReport(shop._id, new Date(), 90);
    expect(r.sales.current).toBe(1470); // the older bill is now inside the window
    expect(r.daily).toHaveLength(90);
  });
});
