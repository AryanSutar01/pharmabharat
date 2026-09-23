import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { Listing } from "@/lib/models/listing";
import { Product } from "@/lib/models/product";
import { applySavings, cartSavings } from "@/lib/orders/optimise-service";

const future = new Date(Date.now() + 400 * 24 * 3600 * 1000);
const USER = "optimise-buyer";

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

async function listing(sellerId: mongoose.Types.ObjectId, productId: mongoose.Types.ObjectId, price: number, stock = 100) {
  return Listing.create({
    sellerId,
    productId,
    batchNo: `B-${price}-${stock}`,
    expiryDate: future,
    mrp: 200,
    price,
    gstRate: 5,
    hsn: "3004",
    stock,
    minOrderQty: 1,
    schedule: "h",
    sellerStateCode: "27",
  });
}

describe("cart optimiser (integration, database: pharmabharat_test)", () => {
  let buyer: BusinessDoc;
  let dear: BusinessDoc;
  let cheap: BusinessDoc;
  let unverified: BusinessDoc;
  let productId: mongoose.Types.ObjectId;
  let dearListing: mongoose.Types.ObjectId;
  let cheapListing: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all([Business, Cart, Listing, Product].map((m) => m.createCollection()));

    buyer = await business("Optimise Retailer", "retailer");
    dear = await business("Costly Distributors", "wholesaler");
    cheap = await business("Cheap Distributors", "wholesaler");
    unverified = await business("Unverified Distributors", "wholesaler", "pending");

    const p = await Product.create({ name: "Optimin 200 Tablet", manufacturer: "Test Labs", mrp: 200, source: "seller" });
    productId = p._id;
    dearListing = (await listing(dear._id, productId, 150))._id;
    cheapListing = (await listing(cheap._id, productId, 120))._id;
    await listing(unverified._id, productId, 90); // cheapest but not verified
    await listing(buyer._id, productId, 80); // the buyer's own stock

    await Cart.create({ businessId: buyer._id, userId: USER, items: [{ listingId: dearListing, qty: 10 }] });
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("suggests the cheapest verified seller, not the buyer's own listing", async () => {
    const savings = await cartSavings(buyer._id, USER);
    expect(savings).toMatchObject({ totalSaving: 300, sellersBefore: 1, sellersAfter: 1 });
    expect(savings!.swaps[0]).toMatchObject({
      from: String(dearListing),
      to: String(cheapListing),
      sellerName: "Cheap Distributors",
      productName: "Optimin 200 Tablet",
      newPrice: 120,
    });
  });

  it("applies the swap and then has nothing left to suggest", async () => {
    expect(await applySavings(buyer._id, USER)).toMatchObject({ applied: 1, saved: 300 });
    const cart = await Cart.findOne({ businessId: buyer._id, userId: USER }).lean();
    expect(cart!.items).toHaveLength(1);
    expect(String(cart!.items[0].listingId)).toBe(String(cheapListing));
    expect(cart!.items[0].qty).toBe(10);

    expect(await cartSavings(buyer._id, USER)).toBeNull();
    expect(await applySavings(buyer._id, USER)).toMatchObject({ applied: 0 });
  });

  it("ignores sellers who cannot cover the quantity", async () => {
    await Cart.updateOne({ businessId: buyer._id, userId: USER }, { $set: { items: [{ listingId: dearListing, qty: 10 }] } });
    await Listing.updateOne({ _id: cheapListing }, { $set: { stock: 4 } });
    expect(await cartSavings(buyer._id, USER)).toBeNull();
  });
});
