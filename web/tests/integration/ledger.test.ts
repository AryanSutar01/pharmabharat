import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import type { StateCode } from "@/lib/india";
import { accountRows, accountSummary, recordPayment, setCreditTerms, statement } from "@/lib/ledger/service";
import { runPaymentReminders } from "@/lib/ledger/reminders";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { CreditAccount, Payment } from "@/lib/models/ledger";
import { Listing } from "@/lib/models/listing";
import { Notification } from "@/lib/models/notification";
import { Membership } from "@/lib/models/membership";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { CheckoutError, placeOrders, transitionOrder } from "@/lib/orders/service";

const future = new Date(Date.now() + 400 * 24 * 3600 * 1000);
const SELLER_USER = "ledger-seller-user";
const BUYER_USER = "ledger-buyer-user";
const USER = { id: SELLER_USER, name: "Seller Staff" };

async function business(name: string, type: "retailer" | "wholesaler", stateCode: StateCode, ownerUserId: string) {
  const b = await Business.create({
    type,
    legalName: name,
    ownerUserId,
    address: { line1: "1 Test Road", city: "Test City", stateCode, pincode: "411001" },
    kyc: { status: "approved" },
  });
  await Membership.create({ businessId: b._id, userId: ownerUserId, role: "owner", status: "active" });
  return b.toObject() as BusinessDoc;
}

describe("credit ledger (integration, database: pharmabharat_test)", () => {
  let buyer: BusinessDoc;
  let seller: BusinessDoc;
  let productId: mongoose.Types.ObjectId;

  /** Places an order for `qty` packs at ₹100 + 5% GST and accepts it (which issues the invoice). */
  async function invoice(qty: number) {
    await Listing.deleteMany({ sellerId: seller._id });
    const l = await Listing.create({
      sellerId: seller._id,
      productId,
      batchNo: `LB${qty}${Date.now()}`,
      expiryDate: future,
      mrp: 120,
      price: 100,
      gstRate: 5,
      hsn: "3004",
      stock: 1000,
      minOrderQty: 1,
      schedule: "h",
      sellerStateCode: seller.address!.stateCode,
    });
    await Cart.updateOne(
      { businessId: buyer._id, userId: BUYER_USER },
      { $set: { items: [{ listingId: l._id, qty }] } },
      { upsert: true },
    );
    const { orders } = await placeOrders({ buyer, userId: BUYER_USER, paymentMode: "credit" });
    const accepted = await transitionOrder({ orderId: orders[0]._id, action: "accept", userId: SELLER_USER });
    return accepted!;
  }

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all(
      [Business, Cart, CreditAccount, Listing, Membership, Notification, Order, Payment, Product].map((m) => m.createCollection()),
    );
    seller = await business("Ledger Wholesaler", "wholesaler", "27", SELLER_USER);
    buyer = await business("Ledger Retailer", "retailer", "27", BUYER_USER);
    const p = await Product.create({ name: "Ledgerin 100 Tablet", manufacturer: "Test Labs", mrp: 120, source: "seller" });
    productId = p._id;
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("sets a due date from the seller's credit terms when the invoice is raised", async () => {
    await setCreditTerms({ sellerId: seller._id, buyerId: buyer._id, creditLimit: 0, creditDays: 15, userId: SELLER_USER });
    const order = await invoice(1);
    expect(order.invoice?.number).toMatch(/^INV\//);
    expect(order.payment?.creditDays).toBe(15);
    const days = (new Date(order.payment!.dueAt!).getTime() - new Date(order.invoice!.date!).getTime()) / (24 * 3600 * 1000);
    expect(Math.round(days)).toBe(15);
  });

  it("settles the oldest invoice first and leaves the rest partly paid", async () => {
    await Order.deleteMany({});
    await Payment.deleteMany({});
    const first = await invoice(1); // ₹105
    const second = await invoice(2); // ₹210
    // Backdate the first invoice so "oldest due" is unambiguous.
    await Order.updateOne({ _id: first._id }, { $set: { "payment.dueAt": new Date(Date.now() - 5 * 24 * 3600 * 1000) } });

    const receipt = await recordPayment({
      seller,
      buyerId: buyer._id,
      amount: 155,
      method: "upi",
      reference: "UTR123",
      user: USER,
    });
    expect(receipt.allocations.map((a) => a.amount)).toEqual([105, 50]);
    expect(receipt.unallocated).toBe(0);

    const [a, b] = await Promise.all([Order.findById(first._id).lean(), Order.findById(second._id).lean()]);
    expect(a!.payment).toMatchObject({ status: "paid", paidAmount: 105 });
    expect(b!.payment).toMatchObject({ status: "partial", paidAmount: 50 });

    const summary = await accountSummary(seller._id, buyer._id);
    expect(summary.outstanding).toBe(160);
    expect(summary.openCount).toBe(1);

    const rows = await accountRows(seller._id, "seller");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ businessId: String(buyer._id), outstanding: 160, invoices: 1 });

    // The buyer sees the mirror image of the same account.
    const payable = await accountRows(buyer._id, "buyer");
    expect(payable[0]).toMatchObject({ businessId: String(seller._id), outstanding: 160 });

    const lines = await statement(seller._id, buyer._id);
    expect(lines.map((l) => l.kind)).toEqual(["invoice", "invoice", "payment"]);
    expect(lines.at(-1)!.balance).toBe(160);
  });

  it("notifies the buyer that a payment was recorded", async () => {
    const notes = await Notification.find({ businessId: buyer._id, kind: "payment_recorded" }).lean();
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].params).toMatchObject({ amount: 155 });
  });

  it("blocks a credit order that would cross the limit", async () => {
    await setCreditTerms({ sellerId: seller._id, buyerId: buyer._id, creditLimit: 200, creditDays: 15, userId: SELLER_USER });
    // ₹160 already outstanding, so another ₹105 invoice does not fit under ₹200.
    await expect(invoice(1)).rejects.toMatchObject({ code: "credit_limit" });
    await expect(invoice(1)).rejects.toBeInstanceOf(CheckoutError);
    await setCreditTerms({ sellerId: seller._id, buyerId: buyer._id, creditLimit: 0, creditDays: 15, userId: SELLER_USER });
  });

  it("reminds the buyer about overdue invoices once a week", async () => {
    await Notification.deleteMany({ kind: "payment_due" });
    await Order.updateMany(
      { "payment.status": { $ne: "paid" } },
      { $set: { "payment.dueAt": new Date(Date.now() - 10 * 24 * 3600 * 1000) }, $unset: { "payment.reminderAt": 1 } },
    );
    const run = await runPaymentReminders();
    expect(run.pairs).toBe(1);
    const sent = await Notification.find({ businessId: buyer._id, kind: "payment_due" }).lean();
    expect(sent).toHaveLength(1);

    // Same day again: the cooldown keeps it quiet.
    expect(await runPaymentReminders()).toMatchObject({ pairs: 0 });
  });
});
