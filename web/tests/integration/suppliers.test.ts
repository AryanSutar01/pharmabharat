import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { CreditAccount, Payment } from "@/lib/models/ledger";
import { Listing } from "@/lib/models/listing";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { Recall } from "@/lib/models/recall";
import { placeOrders, transitionOrder } from "@/lib/orders/service";
import { setCreditTerms } from "@/lib/ledger/service";
import { priceComparison, supplierSummary, topPurchased } from "@/lib/retail/suppliers";

const DAY = 24 * 3600 * 1000;
const BUYER_USER = "sup-buyer";

describe("supplier comparison (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let cheap: BusinessDoc;
  let dear: BusinessDoc;
  let productId: mongoose.Types.ObjectId;

  async function business(name: string, type: "retailer" | "wholesaler") {
    const b = await Business.create({
      type,
      legalName: name,
      ownerUserId: `${name}-owner`,
      address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
      kyc: { status: "approved" },
    });
    return b.toObject() as BusinessDoc;
  }

  /** Buys `qty` from a seller at `price`, with `shelfDays` of life left, and delivers it. */
  async function buy(seller: BusinessDoc, price: number, qty: number, batchNo: string, shelfDays: number) {
    const listing = await Listing.create({
      sellerId: seller._id,
      productId,
      batchNo,
      expiryDate: new Date(Date.now() + shelfDays * DAY),
      mrp: 210,
      price,
      gstRate: 5,
      hsn: "3004",
      stock: 500,
      minOrderQty: 1,
      schedule: "h",
      sellerStateCode: "27",
    });
    await Cart.updateOne(
      { businessId: shop._id, userId: BUYER_USER },
      { $set: { items: [{ listingId: listing._id, qty }] } },
      { upsert: true },
    );
    const { orders } = await placeOrders({ buyer: shop, userId: BUYER_USER, paymentMode: "credit" });
    await transitionOrder({ orderId: orders[0]._id, action: "accept", userId: "seller-user" });
    return orders[0];
  }

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all(
      [Business, Cart, CreditAccount, Listing, Order, Payment, Product, Recall].map((m) => m.createCollection()),
    );

    shop = await business("Supplier Test Pharmacy", "retailer");
    cheap = await business("Cheap Distributors", "wholesaler");
    dear = await business("Costly Distributors", "wholesaler");

    const p = await Product.create({ name: "Compareol 200 Tablet", manufacturer: "Test Labs", mrp: 210, source: "seller" });
    productId = p._id;

    await buy(cheap, 150, 10, "CH-1", 400);
    await buy(cheap, 160, 5, "CH-2", 90); // short-dated: under six months
    await buy(dear, 180, 4, "DR-1", 400);

    // One batch from the dear supplier was later recalled.
    await Recall.create({
      productName: "Compareol 200 Tablet",
      batchNo: "DR-1",
      reason: "Failed dissolution test.",
      issuedBy: "admin",
    });

    await setCreditTerms({ sellerId: cheap._id, buyerId: shop._id, creditLimit: 50_000, creditDays: 21, userId: "admin" });
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("ranks suppliers by spend, with credit terms from the ledger", async () => {
    const rows = await supplierSummary(shop._id);
    expect(rows.map((r) => r.name)).toEqual(["Cheap Distributors", "Costly Distributors"]);

    const first = rows[0];
    expect(first.orders).toBe(2);
    expect(first.spend).toBeGreaterThan(0);
    expect(first).toMatchObject({ creditDays: 21, creditLimit: 50_000 });
    // Both orders are accepted and unpaid, so they show as outstanding.
    expect(first.outstanding).toBeGreaterThan(0);
  });

  it("counts recalled batches and short-dated deliveries per supplier", async () => {
    const rows = await supplierSummary(shop._id);
    const cheapRow = rows.find((r) => r.name === "Cheap Distributors")!;
    const dearRow = rows.find((r) => r.name === "Costly Distributors")!;

    expect(cheapRow).toMatchObject({ recalled: 0, shortDated: 1 });
    expect(dearRow).toMatchObject({ recalled: 1, shortDated: 0 });
  });

  it("compares what each supplier charged for the same medicine", async () => {
    const rows = await priceComparison(shop._id, productId);
    expect(rows.map((r) => r.name)).toEqual(["Cheap Distributors", "Costly Distributors"]);
    expect(rows[0]).toMatchObject({ lastPrice: 160, lowestPrice: 150, packs: 15 });
    expect(rows[1]).toMatchObject({ lastPrice: 180, packs: 4 });
  });

  it("lists the medicines the shop spends most on", async () => {
    const top = await topPurchased(shop._id);
    expect(top).toHaveLength(1);
    expect(top[0].name).toBe("Compareol 200 Tablet");
  });
});
