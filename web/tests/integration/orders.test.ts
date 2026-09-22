import { writeFileSync } from "node:fs";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import type { StateCode } from "@/lib/india";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { Listing } from "@/lib/models/listing";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { renderInvoicePdf } from "@/lib/orders/invoice-pdf";
import { CheckoutError, placeOrders, transitionOrder } from "@/lib/orders/service";

const future = new Date(Date.now() + 400 * 24 * 3600 * 1000);
const USER = "test-user";

async function business(name: string, type: "retailer" | "wholesaler", stateCode: StateCode) {
  const b = await Business.create({
    type,
    legalName: name,
    ownerUserId: USER,
    address: { line1: "1 Test Road", city: "Test City", stateCode, pincode: "411001" },
    kyc: { status: "approved" },
  });
  return b.toObject() as BusinessDoc;
}

async function listing(sellerId: mongoose.Types.ObjectId, productId: mongoose.Types.ObjectId, stock: number, price = 80) {
  const seller = await Business.findById(sellerId).lean();
  return Listing.create({
    sellerId,
    productId,
    batchNo: `B${stock}${price}`,
    expiryDate: future,
    mrp: 100,
    price,
    gstRate: 5,
    hsn: "3004",
    stock,
    minOrderQty: 1,
    schedule: "h",
    sellerStateCode: seller!.address!.stateCode,
  });
}

describe("orders (integration, database: pharmabharat_test)", () => {
  let buyer: BusinessDoc;
  let sellerMH: BusinessDoc;
  let sellerGJ: BusinessDoc;
  let productId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    // Collections must exist before use inside multi-document transactions.
    await Promise.all([Business, Cart, Listing, Order, Product].map((m) => m.createCollection()));
    buyer = await business("Test Retailer", "retailer", "27");
    sellerMH = await business("Seller Maharashtra", "wholesaler", "27");
    sellerGJ = await business("Seller Gujarat", "wholesaler", "24");
    const p = await Product.create({ name: "Testocin 500 Tablet", manufacturer: "Test Labs", mrp: 100, source: "seller" });
    productId = p._id;
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("splits one cart into one order per seller with the right GST type, and reserves stock", async () => {
    const lMH = await listing(sellerMH._id, productId, 50, 80);
    const lGJ = await listing(sellerGJ._id, productId, 50, 75);
    await Cart.create({
      businessId: buyer._id,
      userId: USER,
      items: [
        { listingId: lMH._id, qty: 10 },
        { listingId: lGJ._id, qty: 4 },
      ],
    });

    const { orders } = await placeOrders({ buyer, userId: USER, paymentMode: "credit" });
    expect(orders).toHaveLength(2);

    const mh = orders.find((o) => String(o.sellerId) === String(sellerMH._id))!;
    const gj = orders.find((o) => String(o.sellerId) === String(sellerGJ._id))!;
    // Same state → CGST + SGST; different state → IGST.
    expect(mh.interState).toBe(false);
    expect(mh.totals).toMatchObject({ taxable: 800, cgst: 20, sgst: 20, igst: 0, grandTotal: 840 });
    expect(gj.interState).toBe(true);
    expect(gj.totals).toMatchObject({ taxable: 300, cgst: 0, sgst: 0, igst: 15, grandTotal: 315 });
    expect(mh.orderNo).toMatch(/^PB-\d{4}-\d{6}$/);

    expect((await Listing.findById(lMH._id).lean())!.stock).toBe(40);
    expect((await Listing.findById(lGJ._id).lean())!.stock).toBe(46);
    expect((await Cart.findOne({ businessId: buyer._id, userId: USER }).lean())!.items).toHaveLength(0);
  });

  it("rolls back everything if any line is out of stock", async () => {
    const a = await listing(sellerMH._id, productId, 20, 70);
    const b = await listing(sellerGJ._id, productId, 3, 70);
    await Cart.updateOne(
      { businessId: buyer._id, userId: USER },
      { $set: { items: [{ listingId: a._id, qty: 5 }, { listingId: b._id, qty: 3 }] } },
    );
    // Someone else buys b's stock after the cart was built.
    await Listing.updateOne({ _id: b._id }, { $set: { stock: 1 } });

    const before = await Order.countDocuments();
    await expect(placeOrders({ buyer, userId: USER, paymentMode: "cod" })).rejects.toBeInstanceOf(CheckoutError);
    expect(await Order.countDocuments()).toBe(before);
    expect((await Listing.findById(a._id).lean())!.stock).toBe(20); // untouched
    expect((await Cart.findOne({ businessId: buyer._id, userId: USER }).lean())!.items).toHaveLength(2); // kept
  });

  it("rejects buying your own stock", async () => {
    const own = await listing(buyer._id, productId, 10, 60);
    await Cart.updateOne({ businessId: buyer._id, userId: USER }, { $set: { items: [{ listingId: own._id, qty: 1 }] } });
    await expect(placeOrders({ buyer, userId: USER, paymentMode: "cod" })).rejects.toMatchObject({ code: "own_listing" });
  });

  it("assigns sequential invoice numbers on accept and renders a PDF", async () => {
    const orders = await Order.find({ status: "placed" }).sort({ createdAt: 1 }).lean();
    const accepted = await transitionOrder({ orderId: orders[0]._id, action: "accept", userId: USER });
    expect(accepted?.status).toBe("accepted");
    expect(accepted?.invoice?.number).toMatch(/^INV\/\d{4}-\d{2}\/000001$/);

    // Accepting twice is refused (conditional update).
    expect(await transitionOrder({ orderId: orders[0]._id, action: "accept", userId: USER })).toBeNull();

    const pdf = await renderInvoicePdf(accepted!);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
    // SAVE_INVOICE_PDF=1 npm run test:integration → inspect the layout by eye.
    if (process.env.SAVE_INVOICE_PDF) writeFileSync(".data/sample-invoice.pdf", pdf);
  });

  it("releases stock when an order is rejected or cancelled", async () => {
    const order = await Order.findOne({ status: "placed" }).lean();
    const item = order!.items[0];
    const stockBefore = (await Listing.findById(item.listingId).lean())!.stock;
    const rejected = await transitionOrder({ orderId: order!._id, action: "reject", userId: USER, note: "Out of stock" });
    expect(rejected?.status).toBe("rejected");
    expect((await Listing.findById(item.listingId).lean())!.stock).toBe(stockBefore + item.qty);
    expect(rejected?.history.at(-1)?.note).toBe("Out of stock");
  });
});
