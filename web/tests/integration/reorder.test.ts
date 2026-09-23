import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { Listing } from "@/lib/models/listing";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { parsePurchaseList } from "@/lib/orders/quick-list";
import { matchPurchaseList, reorderLines } from "@/lib/orders/reorder";
import { placeOrders } from "@/lib/orders/service";

const future = new Date(Date.now() + 400 * 24 * 3600 * 1000);
const BUYER_USER = "reorder-buyer";

async function business(name: string, type: "retailer" | "wholesaler", kyc: "approved" | "pending" = "approved") {
  const b = await Business.create({
    type,
    legalName: name,
    ownerUserId: `${name}-owner`,
    address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
    kyc: { status: kyc },
  });
  return b.toObject() as BusinessDoc;
}

async function listing(sellerId: mongoose.Types.ObjectId, productId: mongoose.Types.ObjectId, price: number, stock = 100, minOrderQty = 1) {
  return Listing.create({
    sellerId,
    productId,
    batchNo: `B${price}${stock}`,
    expiryDate: future,
    mrp: 150,
    price,
    gstRate: 5,
    hsn: "3004",
    stock,
    minOrderQty,
    schedule: "h",
    sellerStateCode: "27",
  });
}

describe("quick order & buy again (integration, database: pharmabharat_test)", () => {
  let buyer: BusinessDoc;
  let cheap: BusinessDoc;
  let dear: BusinessDoc;
  let unverified: BusinessDoc;
  let dolo: mongoose.Types.ObjectId;
  let pan: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all([Business, Cart, Listing, Order, Product].map((m) => m.createCollection()));
    // The collation index is what makes case-insensitive name matching work.
    await Product.syncIndexes();

    buyer = await business("Reorder Retailer", "retailer");
    cheap = await business("Cheap Distributors", "wholesaler");
    dear = await business("Costly Distributors", "wholesaler");
    unverified = await business("Unverified Distributors", "wholesaler", "pending");

    const [d, p] = await Product.create([
      { name: "Dolo 650 Tablet", manufacturer: "Micro Labs", mrp: 150, source: "seller" },
      { name: "Pan D Capsule", manufacturer: "Alkem", mrp: 150, source: "seller" },
    ]);
    dolo = d._id;
    pan = p._id;

    await listing(dear._id, dolo, 95);
    await listing(cheap._id, dolo, 88);
    await listing(unverified._id, dolo, 60); // cheapest, but not verified
    await listing(cheap._id, pan, 120, 4, 2); // only 4 in stock, min order 2
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("matches a pasted list to the cheapest verified seller", async () => {
    const lines = await matchPurchaseList(parsePurchaseList("dolo 650 tablet, 10\nPan D Capsule x 25\nNot A Medicine, 2"), buyer._id);
    expect(lines).toHaveLength(3);

    expect(lines[0]).toMatchObject({ status: "ok", qty: 10 });
    expect(lines[0].offer).toMatchObject({ sellerName: "Cheap Distributors", price: 88 });

    // Only 4 packs exist, so the quantity is trimmed and flagged.
    expect(lines[1]).toMatchObject({ status: "adjusted", qty: 4 });

    expect(lines[2]).toMatchObject({ status: "no_product", query: "Not A Medicine" });
  });

  it("does not offer the buyer's own stock", async () => {
    await listing(buyer._id, dolo, 10);
    const [line] = await matchPurchaseList(parsePurchaseList("Dolo 650 Tablet, 1"), buyer._id);
    expect(line.offer?.sellerName).toBe("Cheap Distributors");
  });

  it("re-buys a past order at today's best price", async () => {
    const own = await Listing.findOne({ sellerId: dear._id, productId: dolo }).lean();
    await Cart.create({ businessId: buyer._id, userId: BUYER_USER, items: [{ listingId: own!._id, qty: 3 }] });
    const { orders } = await placeOrders({ buyer, userId: BUYER_USER, paymentMode: "credit" });

    const lines = await reorderLines(String(orders[0]._id), buyer._id);
    expect(lines).toHaveLength(1);
    // Bought from the dearer seller last time; the cheaper one is suggested now.
    expect(lines![0]).toMatchObject({ status: "ok", qty: 3 });
    expect(lines![0].offer).toMatchObject({ sellerName: "Cheap Distributors", price: 88 });

    expect(await reorderLines(String(new mongoose.Types.ObjectId()), buyer._id)).toBeNull();
  });
});
