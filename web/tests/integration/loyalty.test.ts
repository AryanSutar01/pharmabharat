import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Customer } from "@/lib/models/customer";
import { LoyaltyEntry } from "@/lib/models/loyalty";
import { Product } from "@/lib/models/product";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { ShopSettings } from "@/lib/models/shop-settings";
import { createBill } from "@/lib/retail/billing";
import { createCustomer } from "@/lib/retail/customers";
import { expireLoyaltyPoints, loyaltyHistory } from "@/lib/retail/loyalty-service";
import { addStock } from "@/lib/retail/stock";

const DAY = 24 * 3600 * 1000;
const USER = { id: "loyal-staff", name: "Counter Staff" };

describe("loyalty points (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let stockId: string;
  let customerId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all(
      [Bill, Business, Customer, LoyaltyEntry, Product, ShopStock, ShopItem, ShopSettings].map((m) => m.createCollection()),
    );

    const b = await Business.create({
      type: "retailer",
      legalName: "Loyal Pharmacy",
      ownerUserId: "loyal-owner",
      address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
      kyc: { status: "approved" },
    });
    shop = b.toObject() as BusinessDoc;

    // 1 point per ₹100, worth ₹1, usable from 10 points, lapsing after 12 months.
    await ShopSettings.create({
      businessId: shop._id,
      loyalty: { active: true, pointsPerHundred: 1, pointValue: 1, minRedeemPoints: 10, expiryMonths: 12 },
    });

    const p = await Product.create({ name: "Loyalin 100 Tablet", manufacturer: "Test Labs", mrp: 105, source: "seller" });
    await addStock(
      shop._id,
      { productId: p._id, name: "Loyalin 100 Tablet", batchNo: "LY-1", expiryDate: new Date(Date.now() + 400 * DAY), qty: 500, cost: 80, mrp: 105, gstRate: 5 },
      USER.id,
    );
    stockId = String((await ShopStock.findOne({ businessId: shop._id }).lean())!._id);

    const { customer } = await createCustomer(shop._id, { name: "Loyal Customer", phone: "9876500000", consent: true }, USER.id);
    customerId = customer._id;
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("earns points on what the customer actually pays", async () => {
    // 20 packs × ₹105 = ₹2,100 → 21 points.
    const bill = await createBill(shop._id, { lines: [{ stockId, qty: 20 }], customerId: String(customerId) }, USER);
    expect(bill.totals?.grandTotal).toBe(2100);
    expect(bill.loyalty).toMatchObject({ earned: 21, redeemed: 0 });

    expect((await Customer.findById(customerId).lean())!.loyaltyPoints).toBe(21);
    const entries = await loyaltyHistory(shop._id, String(customerId));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "earned", points: 21 });
    expect(entries[0].expiresAt).toBeTruthy();
  });

  it("spends points as money off the next bill, and earns on the reduced amount", async () => {
    const bill = await createBill(
      shop._id,
      { lines: [{ stockId, qty: 10 }], customerId: String(customerId), redeemPoints: 21 },
      USER,
    );
    // ₹1,050 less ₹21 of points = ₹1,029 payable, which earns 10 points back.
    expect(bill.totals).toMatchObject({ redeemed: 21, grandTotal: 1029 });
    expect(bill.loyalty).toMatchObject({ redeemed: 21, earned: 10 });
    // Tax is unaffected by the redemption: the sale still happened at full price.
    expect(bill.totals?.taxable).toBe(1000);

    expect((await Customer.findById(customerId).lean())!.loyaltyPoints).toBe(10);
    const kinds = (await loyaltyHistory(shop._id, String(customerId))).map((e) => e.kind);
    expect(kinds).toEqual(["earned", "redeemed", "earned"]);
  });

  it("refuses to spend more points than the customer has", async () => {
    const bill = await createBill(
      shop._id,
      { lines: [{ stockId, qty: 1 }], customerId: String(customerId), redeemPoints: 9999 },
      USER,
    );
    expect(bill.loyalty?.redeemed).toBe(10); // the whole balance, no more
    expect((await Customer.findById(customerId).lean())!.loyaltyPoints).toBeGreaterThanOrEqual(0);
  });

  it("lapses points that were never used, oldest first", async () => {
    await LoyaltyEntry.deleteMany({ businessId: shop._id });
    await Customer.updateOne({ _id: customerId }, { $set: { loyaltyPoints: 30 } });
    await LoyaltyEntry.create([
      { businessId: shop._id, customerId, kind: "earned", points: 20, expiresAt: new Date(Date.now() - DAY) },
      { businessId: shop._id, customerId, kind: "earned", points: 10, expiresAt: new Date(Date.now() + 100 * DAY) },
    ]);

    expect(await expireLoyaltyPoints(shop._id)).toMatchObject({ customers: 1, points: 20 });
    expect((await Customer.findById(customerId).lean())!.loyaltyPoints).toBe(10);
    // Running again changes nothing: the lapsed batch is already spent.
    expect(await expireLoyaltyPoints(shop._id)).toMatchObject({ points: 0 });
  });

  it("does nothing at all when the shop has no scheme", async () => {
    await ShopSettings.updateOne({ businessId: shop._id }, { $set: { "loyalty.active": false } });
    const before = (await Customer.findById(customerId).lean())!.loyaltyPoints;
    const bill = await createBill(shop._id, { lines: [{ stockId, qty: 5 }], customerId: String(customerId) }, USER);
    expect(bill.loyalty).toMatchObject({ earned: 0, redeemed: 0 });
    expect((await Customer.findById(customerId).lean())!.loyaltyPoints).toBe(before);
  });
});
