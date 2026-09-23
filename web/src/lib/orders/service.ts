import "server-only";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { stateName } from "@/lib/india";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { Listing } from "@/lib/models/listing";
import { Order, nextSequence, type OrderDoc } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { checkCreditForOrder, dueDateFor, recordPayment } from "@/lib/ledger/service";
import { computeTotals, financialYear, lineTax, round2 } from "@/lib/orders/gst";
import { TRANSITIONS, type OrderAction, type PaymentMode } from "@/lib/orders/status";

const MIN_SHELF_LIFE_MS = 30 * 24 * 3600 * 1000;

export class CheckoutError extends Error {
  constructor(
    public code: "cart_empty" | "cart_changed" | "out_of_stock" | "own_listing" | "credit_limit",
    public listingId?: string,
    /** For credit_limit: which seller refused and what is still available. */
    public detail?: { seller: string; available: number },
  ) {
    super(code);
  }
}

/** Frozen copy of a business for the invoice. */
export function partySnapshot(b: BusinessDoc) {
  const a = b.address;
  return {
    name: b.tradeName || b.legalName,
    gstin: b.gstin ?? undefined,
    pan: b.pan ?? undefined,
    phone: b.phone ?? undefined,
    email: b.email ?? undefined,
    address: a
      ? [a.line1, a.line2, a.city, a.district, `${stateName(a.stateCode)} ${a.pincode}`].filter(Boolean).join(", ")
      : "",
    stateCode: a?.stateCode ?? "",
    drugLicenses: b.drugLicenses.map((l) => `${l.form}: ${l.number}`).join(", "),
  };
}

/**
 * Turns the buyer's cart into one order per seller, atomically:
 * stock is decremented only if every line can be fulfilled.
 */
export async function placeOrders(opts: {
  buyer: BusinessDoc;
  userId: string;
  paymentMode: PaymentMode;
  notes?: string;
}): Promise<{ groupId: string; orders: OrderDoc[] }> {
  await connectDB();
  const { buyer, userId } = opts;
  const cart = await Cart.findOne({ businessId: buyer._id, userId }).lean();
  if (!cart?.items.length) throw new CheckoutError("cart_empty");

  const listings = await Listing.find({ _id: { $in: cart.items.map((i) => i.listingId) } }).lean();
  const listingById = new Map(listings.map((l) => [String(l._id), l]));
  const products = await Product.find({ _id: { $in: listings.map((l) => l.productId) } }).lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const sellers = await Business.find({ _id: { $in: listings.map((l) => l.sellerId) }, "kyc.status": "approved" }).lean();
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));

  // Validate every line before touching stock.
  const bySeller = new Map<string, { listingId: mongoose.Types.ObjectId; qty: number }[]>();
  for (const item of cart.items) {
    const l = listingById.get(String(item.listingId));
    const ok =
      l &&
      l.status === "active" &&
      sellerById.has(String(l.sellerId)) &&
      productById.has(String(l.productId)) &&
      new Date(l.expiryDate).getTime() > Date.now() + MIN_SHELF_LIFE_MS &&
      item.qty >= (l.minOrderQty ?? 1);
    if (!ok) throw new CheckoutError("cart_changed", String(item.listingId));
    if (String(l.sellerId) === String(buyer._id)) throw new CheckoutError("own_listing", String(l._id));
    if (item.qty > l.stock) throw new CheckoutError("out_of_stock", String(l._id));
    const key = String(l.sellerId);
    bySeller.set(key, [...(bySeller.get(key) ?? []), { listingId: l._id, qty: item.qty }]);
  }

  // Credit limits are per seller: check each group before reserving any stock.
  if (opts.paymentMode === "credit") {
    for (const [sellerId, lines] of bySeller) {
      const seller = sellerById.get(sellerId)!;
      const interState = (seller.address?.stateCode ?? "") !== (buyer.address?.stateCode ?? "");
      const total = computeTotals(
        lines.map(({ listingId, qty }) => {
          const l = listingById.get(String(listingId))!;
          return lineTax({ price: l.price, qty, gstRate: l.gstRate, hsn: l.hsn }, interState);
        }),
      ).grandTotal;
      const check = await checkCreditForOrder(seller._id, buyer._id, total);
      if (!check.allowed) {
        throw new CheckoutError("credit_limit", undefined, {
          seller: seller.tradeName || seller.legalName,
          available: Math.max(check.available ?? 0, 0),
        });
      }
    }
  }

  const groupId = randomUUID();
  const buyerParty = partySnapshot(buyer);
  const now = new Date();
  const month = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const created: OrderDoc[] = [];

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      created.length = 0;
      for (const [sellerId, lines] of bySeller) {
        const seller = sellerById.get(sellerId)!;
        const sellerParty = partySnapshot(seller);
        const interState = sellerParty.stateCode !== buyerParty.stateCode;

        const items = [];
        for (const { listingId, qty } of lines) {
          // Atomic reserve: fails if someone else bought the stock meanwhile.
          const res = await Listing.updateOne(
            { _id: listingId, status: "active", stock: { $gte: qty } },
            { $inc: { stock: -qty } },
            { session },
          );
          if (res.modifiedCount !== 1) throw new CheckoutError("out_of_stock", String(listingId));
          const l = listingById.get(String(listingId))!;
          const p = productById.get(String(l.productId))!;
          const tax = lineTax({ price: l.price, qty, gstRate: l.gstRate, hsn: l.hsn }, interState);
          items.push({
            listingId: l._id,
            productId: l.productId,
            name: p.name,
            manufacturer: p.manufacturer,
            packSizeLabel: p.packSizeLabel,
            batchNo: l.batchNo,
            expiryDate: l.expiryDate,
            hsn: l.hsn,
            qty,
            mrp: l.mrp,
            price: l.price,
            gstRate: l.gstRate,
            ...tax,
          });
        }

        const seq = await nextSequence(`order:${month}`, session);
        const [order] = await Order.create(
          [
            {
              orderNo: `PB-${month}-${String(seq).padStart(6, "0")}`,
              groupId,
              buyerId: buyer._id,
              sellerId: seller._id,
              placedBy: userId,
              buyer: buyerParty,
              seller: sellerParty,
              interState,
              items,
              totals: computeTotals(items),
              status: "placed",
              history: [{ status: "placed", at: now, by: userId }],
              notes: opts.notes,
              payment: { mode: opts.paymentMode, status: "unpaid" },
            },
          ],
          { session },
        );
        created.push(order.toObject() as OrderDoc);
      }
      await Cart.updateOne({ _id: cart._id }, { $set: { items: [] } }, { session });
    });
  } finally {
    await session.endSession();
  }
  return { groupId, orders: created };
}

/**
 * Applies a status transition. Uses a conditional update so two people
 * clicking at once can't both succeed. Returns null if not allowed.
 */
export async function transitionOrder(opts: {
  orderId: mongoose.Types.ObjectId | string;
  action: Exclude<OrderAction, "markPaid">;
  userId: string;
  note?: string;
}) {
  await connectDB();
  const t = TRANSITIONS[opts.action];
  const now = new Date();
  const session = await mongoose.startSession();
  let updated: OrderDoc | null = null;
  try {
    await session.withTransaction(async () => {
      const set: Record<string, unknown> = { status: t.to };
      if (opts.action === "accept") {
        const current = await Order.findById(opts.orderId, { sellerId: 1, buyerId: 1, status: 1, payment: 1 }).session(session).lean();
        if (!current || !t.from.includes(current.status)) return;
        const fy = financialYear(now);
        const seq = await nextSequence(`inv:${current.sellerId}:${fy}`, session);
        set["invoice.number"] = `INV/${fy}/${String(seq).padStart(6, "0")}`;
        set["invoice.date"] = now;
        // Payment becomes due from the invoice date, using this buyer's credit terms.
        const terms = await dueDateFor({
          sellerId: current.sellerId,
          buyerId: current.buyerId,
          mode: current.payment?.mode ?? "credit",
          from: now,
        });
        set["payment.creditDays"] = terms.creditDays;
        set["payment.dueAt"] = terms.dueAt;
      }
      updated = await Order.findOneAndUpdate(
        { _id: opts.orderId, status: { $in: t.from } },
        { $set: set, $push: { history: { status: t.to, at: now, by: opts.userId, note: opts.note } } },
        { returnDocument: "after", session },
      ).lean();
      if (updated && t.releasesStock) {
        for (const item of (updated as OrderDoc).items) {
          await Listing.updateOne({ _id: item.listingId }, { $inc: { stock: item.qty } }, { session });
        }
      }
    });
  } finally {
    await session.endSession();
  }
  return updated as OrderDoc | null;
}

/**
 * Seller confirms the remaining amount was received (no gateway in v1).
 * Goes through the ledger so the statement and the order stay in step.
 */
export async function markOrderPaid(orderId: string, user: { id: string; name: string }) {
  await connectDB();
  const order = await Order.findOne({ _id: orderId, status: { $in: ["dispatched", "delivered"] } }).lean();
  if (!order || order.payment?.status === "paid") return null;
  const owing = round2((order.totals?.grandTotal ?? 0) - (order.payment?.paidAmount ?? 0));
  if (owing <= 0) return null;
  const seller = await Business.findById(order.sellerId).lean();
  if (!seller) return null;
  await recordPayment({
    seller,
    buyerId: order.buyerId,
    amount: owing,
    method: order.payment?.mode === "cod" ? "cash" : "bank",
    note: `Order ${order.orderNo}`,
    user,
  });
  return Order.findById(orderId).lean();
}