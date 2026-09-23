import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { Listing } from "@/lib/models/listing";
import { Order, type OrderDoc } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { placeOrders, transitionOrder } from "@/lib/orders/service";
import { addStock, listStock, receiveOrder, setStockQty, stockSummary } from "@/lib/retail/stock";

const future = new Date(Date.now() + 400 * 24 * 3600 * 1000);
const BUYER_USER = "shop-buyer";
const SELLER_USER = "shop-seller";

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

describe("shop stock (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let supplier: BusinessDoc;
  let productId: mongoose.Types.ObjectId;
  let order: OrderDoc;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all([Business, Cart, Listing, Order, Product, ShopStock, ShopItem].map((m) => m.createCollection()));

    shop = await business("Shelf Pharmacy", "retailer");
    supplier = await business("Shelf Distributors", "wholesaler");
    const p = await Product.create({
      name: "Shelfocin 500 Tablet",
      manufacturer: "Test Labs",
      packSizeLabel: "strip of 10",
      mrp: 105,
      source: "seller",
    });
    productId = p._id;

    const listing = await Listing.create({
      sellerId: supplier._id,
      productId,
      batchNo: "SB-01",
      expiryDate: future,
      mrp: 105,
      price: 80,
      gstRate: 5,
      hsn: "3004",
      stock: 100,
      minOrderQty: 1,
      schedule: "h",
      sellerStateCode: "27",
    });
    await Cart.create({ businessId: shop._id, userId: BUYER_USER, items: [{ listingId: listing._id, qty: 12 }] });
    const placed = await placeOrders({ buyer: shop, userId: BUYER_USER, paymentMode: "credit" });
    order = placed.orders[0];
    for (const action of ["accept", "pack", "dispatch", "deliver"] as const) {
      await transitionOrder({ orderId: order._id, action, userId: SELLER_USER });
    }
    order = (await Order.findById(order._id).lean()) as OrderDoc;
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("puts a delivered order on the shelf with its cost and supplier", async () => {
    expect(await receiveOrder(order, SELLER_USER)).toMatchObject({ added: 1 });
    const batch = await ShopStock.findOne({ businessId: shop._id, batchNo: "SB-01" }).lean();
    expect(batch).toMatchObject({
      qty: 12,
      cost: 80, // what the shop paid, excluding GST
      mrp: 105,
      source: "order",
      supplierName: "Shelf Distributors",
      name: "Shelfocin 500 Tablet",
    });
    expect(String(batch!.supplierId)).toBe(String(supplier._id));
    // A per-product row is created so a reorder level can be kept later.
    expect(await ShopItem.countDocuments({ businessId: shop._id, productId })).toBe(1);
  });

  it("does not double-count if the order is received again", async () => {
    expect(await receiveOrder(order, SELLER_USER)).toMatchObject({ added: 0 });
    expect((await ShopStock.findOne({ businessId: shop._id, batchNo: "SB-01" }).lean())!.qty).toBe(12);
  });

  it("tops up an existing batch and keeps the latest prices", async () => {
    await addStock(
      shop._id,
      {
        productId,
        name: "Shelfocin 500 Tablet",
        batchNo: "sb-01", // same batch, typed in lower case
        expiryDate: future,
        qty: 8,
        cost: 82,
        mrp: 110,
        gstRate: 5,
      },
      "shop-staff",
    );
    const batch = await ShopStock.findOne({ businessId: shop._id, batchNo: "SB-01" }).lean();
    expect(batch).toMatchObject({ qty: 20, cost: 82, mrp: 110 });
  });

  it("values the shelf at cost and at MRP, and counts what is expiring", async () => {
    await addStock(
      shop._id,
      {
        productId,
        name: "Shelfocin 500 Tablet",
        batchNo: "SB-OLD",
        expiryDate: new Date(Date.now() + 40 * 24 * 3600 * 1000),
        qty: 5,
        cost: 80,
        mrp: 105,
        gstRate: 5,
      },
      "shop-staff",
    );
    const summary = await stockSummary(shop._id);
    expect(summary).toMatchObject({ batches: 2, packs: 25, value: 2040, expiring: 1, expired: 0 });

    const expiring = await listStock(shop._id, { filter: "expiring" });
    expect(expiring.map((r) => r.batchNo)).toEqual(["SB-OLD"]);
    expect(expiring[0].daysToExpiry).toBe(40);
  });

  it("lets the shop correct a count, including down to zero", async () => {
    const batch = await ShopStock.findOne({ businessId: shop._id, batchNo: "SB-OLD" }).lean();
    await setStockQty(shop._id, String(batch!._id), 0);
    expect((await listStock(shop._id, { filter: "out" })).map((r) => r.batchNo)).toEqual(["SB-OLD"]);
    expect((await stockSummary(shop._id)).batches).toBe(1);
  });
});
