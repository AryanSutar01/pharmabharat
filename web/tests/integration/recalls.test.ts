import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { Listing } from "@/lib/models/listing";
import { Membership } from "@/lib/models/membership";
import { Notification } from "@/lib/models/notification";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { Recall } from "@/lib/models/recall";
import { placeOrders, transitionOrder } from "@/lib/orders/service";
import { issueRecall, recallsForBatches, withdrawRecall } from "@/lib/recalls/service";

const future = new Date(Date.now() + 400 * 24 * 3600 * 1000);
const SELLER_USER = "recall-seller";
const BUYER_USER = "recall-buyer";
const ADMIN = { id: "recall-admin", name: "Admin" };
const BATCH = "RC-2026-01";

async function business(name: string, type: "retailer" | "wholesaler", ownerUserId: string) {
  const b = await Business.create({
    type,
    legalName: name,
    ownerUserId,
    address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
    kyc: { status: "approved" },
  });
  await Membership.create({ businessId: b._id, userId: ownerUserId, role: "owner", status: "active" });
  return b.toObject() as BusinessDoc;
}

describe("batch recalls (integration, database: pharmabharat_test)", () => {
  let buyer: BusinessDoc;
  let seller: BusinessDoc;
  let productId: mongoose.Types.ObjectId;
  let listingId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all(
      [Business, Cart, Listing, Membership, Notification, Order, Product, Recall].map((m) => m.createCollection()),
    );
    seller = await business("Recall Wholesaler", "wholesaler", SELLER_USER);
    buyer = await business("Recall Retailer", "retailer", BUYER_USER);
    const p = await Product.create({ name: "Recallin 250 Tablet", manufacturer: "Test Labs", mrp: 100, source: "seller" });
    productId = p._id;

    const l = await Listing.create({
      sellerId: seller._id,
      productId,
      batchNo: BATCH,
      expiryDate: future,
      mrp: 100,
      price: 80,
      gstRate: 5,
      hsn: "3004",
      stock: 50,
      minOrderQty: 1,
      schedule: "h",
      sellerStateCode: "27",
    });
    listingId = l._id;

    // The buyer already bought this batch, so they must be warned too.
    await Cart.create({ businessId: buyer._id, userId: BUYER_USER, items: [{ listingId, qty: 2 }] });
    const { orders } = await placeOrders({ buyer, userId: BUYER_USER, paymentMode: "credit" });
    await transitionOrder({ orderId: orders[0]._id, action: "accept", userId: SELLER_USER });
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("holds the matching listings and warns both sides", async () => {
    const recall = await issueRecall({
      productName: "recallin 250",
      manufacturer: "Test Labs",
      batchNo: BATCH.toLowerCase(),
      severity: "recall",
      reason: "Failed dissolution test (NSQ).",
      reference: "CDSCO/2026/001",
      user: ADMIN,
    });
    expect(recall.batchNo).toBe(BATCH);
    expect(recall.stats).toMatchObject({ listings: 1, sellers: 1, orders: 1, buyers: 1 });

    const listing = await Listing.findById(listingId).lean();
    expect(listing!.status).toBe("paused");
    expect(listing!.moderation?.held).toBe(true);
    expect(String(listing!.recallId)).toBe(String(recall._id));

    const sellerNote = await Notification.findOne({ businessId: seller._id, kind: "batch_recall" }).lean();
    const buyerNote = await Notification.findOne({ businessId: buyer._id, kind: "batch_recall" }).lean();
    expect(sellerNote!.params).toMatchObject({ batchNo: BATCH });
    expect(buyerNote!.link).toBe("/app/orders?filter=all");
  });

  it("finds the active recall for an order's batches", async () => {
    const found = await recallsForBatches([`  ${BATCH.toLowerCase()} `, "SOME-OTHER"]);
    expect(found).toHaveLength(1);
    expect(found[0].reason).toContain("dissolution");
  });

  it("leaves other batches of the same product alone", async () => {
    const other = await Listing.create({
      sellerId: seller._id,
      productId,
      batchNo: "SAFE-01",
      expiryDate: future,
      mrp: 100,
      price: 82,
      gstRate: 5,
      hsn: "3004",
      stock: 10,
      minOrderQty: 1,
      schedule: "h",
      sellerStateCode: "27",
    });
    expect((await Listing.findById(other._id).lean())!.status).toBe("active");
  });

  it("releases the hold when the recall is withdrawn, but keeps the listing paused", async () => {
    const recall = await Recall.findOne({ batchNo: BATCH, status: "active" }).lean();
    expect(await withdrawRecall(recall!._id, ADMIN.id)).toBeTruthy();
    expect(await withdrawRecall(recall!._id, ADMIN.id)).toBeNull(); // already withdrawn

    const listing = await Listing.findById(listingId).lean();
    expect(listing!.moderation?.held).toBe(false);
    expect(listing!.recallId).toBeNull();
    expect(listing!.status).toBe("paused");
    expect(await recallsForBatches([BATCH])).toHaveLength(0);
  });
});
