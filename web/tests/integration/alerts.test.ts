import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runExpiryAlerts } from "@/lib/alerts/expiry";
import { checkPriceAlerts } from "@/lib/alerts/price";
import { connectDB } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { Listing } from "@/lib/models/listing";
import { Membership } from "@/lib/models/membership";
import { Notification } from "@/lib/models/notification";
import { PriceAlert } from "@/lib/models/price-alert";
import { Product } from "@/lib/models/product";

const DAY = 24 * 3600 * 1000;
const BUYER_USER = "buyer-user";
const SELLER_USER = "seller-user";

describe("alerts (integration, database: pharmabharat_test)", () => {
  let sellerId: mongoose.Types.ObjectId;
  let buyerId: mongoose.Types.ObjectId;
  let productId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    const seller = await Business.create({
      type: "wholesaler",
      legalName: "Alert Seller",
      ownerUserId: SELLER_USER,
      address: { line1: "x", city: "Pune", stateCode: "27", pincode: "411001" },
      kyc: { status: "approved" },
    });
    const buyer = await Business.create({
      type: "retailer",
      legalName: "Alert Buyer",
      ownerUserId: BUYER_USER,
      address: { line1: "x", city: "Pune", stateCode: "27", pincode: "411001" },
      kyc: { status: "approved" },
    });
    sellerId = seller._id;
    buyerId = buyer._id;
    await Membership.create([
      { businessId: sellerId, userId: SELLER_USER, role: "owner" },
      { businessId: buyerId, userId: BUYER_USER, role: "owner" },
    ]);
    productId = (await Product.create({ name: "Alertol 10 Tablet", manufacturer: "Test", mrp: 100, source: "seller" }))._id;
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("notifies a watcher once when the best price drops past their threshold", async () => {
    const listing = await Listing.create({
      sellerId,
      productId,
      batchNo: "P1",
      expiryDate: new Date(Date.now() + 400 * DAY),
      mrp: 100,
      price: 80,
      gstRate: 5,
      hsn: "3004",
      stock: 10,
      schedule: "h",
      sellerStateCode: "27",
    });
    await PriceAlert.create({
      userId: BUYER_USER,
      businessId: buyerId,
      productId,
      direction: "drop",
      thresholdPct: 5,
      email: false,
      referencePrice: 80,
    });

    // 2.5% drop: below threshold → nothing.
    await Listing.updateOne({ _id: listing._id }, { price: 78 });
    await checkPriceAlerts([productId]);
    expect(await Notification.countDocuments({ userId: BUYER_USER })).toBe(0);

    // 10% drop from the reference → one notification, reference moves.
    await Listing.updateOne({ _id: listing._id }, { price: 72 });
    await checkPriceAlerts([productId]);
    const n = await Notification.find({ userId: BUYER_USER }).lean();
    expect(n).toHaveLength(1);
    expect(n[0].kind).toBe("price_drop");
    expect(n[0].params).toMatchObject({ from: 80, to: 72, change: 10 });
    expect((await PriceAlert.findOne({ userId: BUYER_USER }).lean())!.referencePrice).toBe(72);

    // Re-checking without a new move does not repeat the alert.
    await checkPriceAlerts([productId]);
    expect(await Notification.countDocuments({ userId: BUYER_USER })).toBe(1);

    // A rise is ignored for a drop-only alert.
    await Listing.updateOne({ _id: listing._id }, { price: 90 });
    await checkPriceAlerts([productId]);
    expect(await Notification.countDocuments({ userId: BUYER_USER })).toBe(1);
  });

  it("warns sellers about near-expiry stock once per level and is idempotent", async () => {
    await Listing.create({
      sellerId,
      productId,
      batchNo: "E45",
      expiryDate: new Date(Date.now() + 45 * DAY),
      mrp: 100,
      price: 70,
      gstRate: 5,
      hsn: "3004",
      stock: 25,
      schedule: "h",
      sellerStateCode: "27",
    });

    const first = await runExpiryAlerts();
    expect(first).toEqual({ sellers: 1, listings: 1 });
    const notes = await Notification.find({ userId: SELLER_USER, kind: "expiry_soon" }).lean();
    expect(notes).toHaveLength(1);
    expect(notes[0].params).toMatchObject({ count: 1, days: 60 });
    expect((await Listing.findOne({ batchNo: "E45" }).lean())!.expiryAlertLevel).toBe(60);

    // Same day again → nothing new.
    expect(await runExpiryAlerts()).toEqual({ sellers: 0, listings: 0 });

    // 20 days later the batch crosses 30 days → one more warning.
    expect(await runExpiryAlerts(new Date(Date.now() + 20 * DAY))).toEqual({ sellers: 1, listings: 1 });
    expect((await Listing.findOne({ batchNo: "E45" }).lean())!.expiryAlertLevel).toBe(30);
  });
});
