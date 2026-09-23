import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { CreditAccount, Payment, type PaymentDoc, type PaymentMethod } from "@/lib/models/ledger";
import { Order } from "@/lib/models/order";
import { notify } from "@/lib/notifications";
import { round2 } from "@/lib/orders/gst";
import type { OrderStatus } from "@/lib/orders/status";
import { accountTotals, allocatePayment, creditCheck, daysOverdue, type OpenInvoice } from "./allocate";

/** Orders that count on the ledger: an invoice exists and it isn't cancelled/rejected. */
const INVOICED_STATUSES: OrderStatus[] = ["accepted", "packed", "dispatched", "delivered"];

export type AccountRow = {
  businessId: string;
  name: string;
  city: string;
  outstanding: number;
  overdue: number;
  daysOverdue: number;
  invoices: number;
  creditLimit: number;
  creditDays: number;
  available: number | null;
  lastPaymentAt: string | null;
};

function toOpenInvoice(o: {
  _id: unknown;
  orderNo: string;
  totals?: { grandTotal: number } | null;
  payment?: { paidAmount?: number | null; dueAt?: Date | null } | null;
  createdAt: Date;
}): OpenInvoice {
  return {
    id: String(o._id),
    orderNo: o.orderNo,
    total: o.totals?.grandTotal ?? 0,
    paid: o.payment?.paidAmount ?? 0,
    dueAt: o.payment?.dueAt ? new Date(o.payment.dueAt) : new Date(o.createdAt),
  };
}

export async function getCreditTerms(sellerId: mongoose.Types.ObjectId, buyerId: mongoose.Types.ObjectId) {
  await connectDB();
  const acc = await CreditAccount.findOne({ sellerId, buyerId }).lean();
  return { creditLimit: acc?.creditLimit ?? 0, creditDays: acc?.creditDays ?? 30, note: acc?.note ?? "" };
}

export async function setCreditTerms(opts: {
  sellerId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  creditLimit: number;
  creditDays: number;
  note?: string;
  userId: string;
}) {
  await connectDB();
  await CreditAccount.updateOne(
    { sellerId: opts.sellerId, buyerId: opts.buyerId },
    { $set: { creditLimit: opts.creditLimit, creditDays: opts.creditDays, note: opts.note, updatedBy: opts.userId } },
    { upsert: true },
  );
}

/** Unpaid/partly paid invoices for one buyer–seller pair. */
export async function openInvoices(sellerId: mongoose.Types.ObjectId, buyerId: mongoose.Types.ObjectId) {
  await connectDB();
  const orders = await Order.find(
    { sellerId, buyerId, status: { $in: INVOICED_STATUSES }, "payment.status": { $ne: "paid" } },
    { orderNo: 1, "totals.grandTotal": 1, payment: 1, createdAt: 1 },
  )
    .sort({ "payment.dueAt": 1 })
    .lean();
  return orders.map(toOpenInvoice);
}

export async function accountSummary(sellerId: mongoose.Types.ObjectId, buyerId: mongoose.Types.ObjectId, now = new Date()) {
  const [open, terms, receipts] = await Promise.all([
    openInvoices(sellerId, buyerId),
    getCreditTerms(sellerId, buyerId),
    Payment.aggregate<{ total: number; last: Date }>([
      { $match: { sellerId, buyerId } },
      { $group: { _id: null, total: { $sum: "$amount" }, last: { $max: "$receivedAt" } } },
    ]),
  ]);
  const totals = accountTotals(open, receipts[0]?.total ?? 0, now);
  return {
    ...totals,
    ...terms,
    daysOverdue: daysOverdue(totals.oldestDueAt, now),
    available: terms.creditLimit > 0 ? round2(terms.creditLimit - totals.outstanding) : null,
    lastPaymentAt: receipts[0]?.last ? new Date(receipts[0].last).toISOString() : null,
    openCount: open.length,
  };
}

/** One row per counterparty with money outstanding (seller view or buyer view). */
export async function accountRows(businessId: mongoose.Types.ObjectId, side: "seller" | "buyer", now = new Date()): Promise<AccountRow[]> {
  await connectDB();
  const mine = side === "seller" ? "sellerId" : "buyerId";
  const theirs = side === "seller" ? "buyerId" : "sellerId";

  const rows = await Order.aggregate<{ _id: mongoose.Types.ObjectId; invoices: number; outstanding: number; overdue: number; oldestDue: Date | null }>([
    { $match: { [mine]: businessId, status: { $in: INVOICED_STATUSES }, "payment.status": { $ne: "paid" } } },
    {
      $project: {
        party: `$${theirs}`,
        owing: { $subtract: ["$totals.grandTotal", { $ifNull: ["$payment.paidAmount", 0] }] },
        dueAt: { $ifNull: ["$payment.dueAt", "$createdAt"] },
      },
    },
    { $match: { owing: { $gt: 0.009 } } },
    {
      $group: {
        _id: "$party",
        invoices: { $sum: 1 },
        outstanding: { $sum: "$owing" },
        overdue: { $sum: { $cond: [{ $lt: ["$dueAt", now] }, "$owing", 0] } },
        oldestDue: { $min: { $cond: [{ $lt: ["$dueAt", now] }, "$dueAt", null] } },
      },
    },
    { $sort: { overdue: -1, outstanding: -1 } },
    { $limit: 200 },
  ]);
  if (!rows.length) return [];

  const ids = rows.map((r) => r._id);
  const [parties, accounts, lastPayments] = await Promise.all([
    Business.find({ _id: { $in: ids } }, { legalName: 1, tradeName: 1, address: 1 }).lean(),
    // Terms belong to the (seller, buyer) pair, and both sides may read them.
    side === "seller"
      ? CreditAccount.find({ sellerId: businessId, buyerId: { $in: ids } }).lean()
      : CreditAccount.find({ buyerId: businessId, sellerId: { $in: ids } }).lean(),
    Payment.aggregate<{ _id: mongoose.Types.ObjectId; last: Date }>([
      { $match: { [mine]: businessId, [theirs]: { $in: ids } } },
      { $group: { _id: `$${theirs}`, last: { $max: "$receivedAt" } } },
    ]),
  ]);
  const byId = new Map(parties.map((p) => [String(p._id), p]));
  const termsById = new Map(accounts.map((a) => [String(side === "seller" ? a.buyerId : a.sellerId), a]));
  const lastById = new Map(lastPayments.map((p) => [String(p._id), p.last]));

  return rows.map((r) => {
    const p = byId.get(String(r._id));
    const terms = termsById.get(String(r._id));
    const limit = terms?.creditLimit ?? 0;
    return {
      businessId: String(r._id),
      name: p ? p.tradeName || p.legalName : "—",
      city: p?.address?.city ?? "",
      outstanding: round2(r.outstanding),
      overdue: round2(r.overdue),
      daysOverdue: daysOverdue(r.oldestDue ? new Date(r.oldestDue) : null, now),
      invoices: r.invoices,
      creditLimit: limit,
      creditDays: terms?.creditDays ?? 30,
      available: limit > 0 ? round2(limit - r.outstanding) : null,
      lastPaymentAt: lastById.get(String(r._id))?.toISOString() ?? null,
    };
  });
}

export type StatementRow = {
  id: string;
  date: string;
  kind: "invoice" | "payment";
  label: string;
  debit: number;
  credit: number;
  balance: number;
  status?: string;
  dueAt?: string | null;
  href?: string;
};

/** Invoices and receipts in one list, oldest first, with a running balance. */
export async function statement(sellerId: mongoose.Types.ObjectId, buyerId: mongoose.Types.ObjectId, limit = 200) {
  await connectDB();
  const [orders, payments] = await Promise.all([
    Order.find(
      { sellerId, buyerId, status: { $in: INVOICED_STATUSES } },
      { orderNo: 1, totals: 1, payment: 1, invoice: 1, createdAt: 1, status: 1 },
    )
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean(),
    Payment.find({ sellerId, buyerId }).sort({ receivedAt: 1 }).limit(limit).lean(),
  ]);

  const rows: Omit<StatementRow, "balance">[] = [
    ...orders.map((o) => ({
      id: String(o._id),
      date: new Date(o.invoice?.date ?? o.createdAt).toISOString(),
      kind: "invoice" as const,
      label: o.invoice?.number || o.orderNo,
      debit: o.totals?.grandTotal ?? 0,
      credit: 0,
      status: o.payment?.status ?? "unpaid",
      dueAt: o.payment?.dueAt ? new Date(o.payment.dueAt).toISOString() : null,
      href: `/app/orders/${o._id}`,
    })),
    ...payments.map((p) => ({
      id: String(p._id),
      date: new Date(p.receivedAt ?? p.createdAt).toISOString(),
      kind: "payment" as const,
      label: p.reference || p.method || "payment",
      debit: 0,
      credit: p.amount,
      status: p.method ?? undefined,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let balance = 0;
  return rows.map((r) => {
    balance = round2(balance + r.debit - r.credit);
    return { ...r, balance };
  });
}

export class LedgerError extends Error {
  constructor(public code: "invalid_amount" | "no_open_invoices") {
    super(code);
  }
}

/**
 * Records money received from a buyer and settles the oldest invoices first.
 * Runs in a transaction so invoices and the receipt can't disagree.
 */
export async function recordPayment(opts: {
  seller: BusinessDoc;
  buyerId: mongoose.Types.ObjectId;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  receivedAt?: Date;
  user: { id: string; name: string };
}) {
  await connectDB();
  const amount = round2(opts.amount);
  if (!(amount > 0)) throw new LedgerError("invalid_amount");

  const open = await openInvoices(opts.seller._id, opts.buyerId);
  const { allocations, unallocated } = allocatePayment(amount, open);
  const now = new Date();

  const session = await mongoose.startSession();
  let payment: PaymentDoc | null = null;
  try {
    await session.withTransaction(async () => {
      for (const a of allocations) {
        await Order.updateOne(
          { _id: a.id },
          {
            $inc: { "payment.paidAmount": a.amount },
            $set: { "payment.status": a.settles ? "paid" : "partial", ...(a.settles ? { "payment.paidAt": now } : {}) },
          },
          { session },
        );
      }
      const [doc] = await Payment.create(
        [
          {
            sellerId: opts.seller._id,
            buyerId: opts.buyerId,
            amount,
            method: opts.method,
            reference: opts.reference,
            note: opts.note,
            receivedAt: opts.receivedAt ?? now,
            recordedBy: opts.user.id,
            recordedByName: opts.user.name,
            allocations: allocations.map((a) => ({ orderId: a.id, orderNo: a.orderNo, amount: a.amount })),
            unallocated,
          },
        ],
        { session },
      );
      payment = doc.toObject() as PaymentDoc;
    });
  } finally {
    await session.endSession();
  }

  await notify({
    businessId: opts.buyerId,
    permission: "billing.view",
    kind: "payment_recorded",
    params: { amount, seller: opts.seller.tradeName || opts.seller.legalName, invoices: allocations.length },
    link: "/app/ledger",
  });
  return payment!;
}

/** Checkout guard: does this credit order fit inside the buyer's limit with this seller? */
export async function checkCreditForOrder(sellerId: mongoose.Types.ObjectId, buyerId: mongoose.Types.ObjectId, orderTotal: number) {
  const summary = await accountSummary(sellerId, buyerId);
  return { ...creditCheck({ outstanding: summary.outstanding, creditLimit: summary.creditLimit, orderTotal }), summary };
}

/** Due date for a new invoice: invoice date + the seller's credit days (COD is due at once). */
export async function dueDateFor(opts: {
  sellerId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  mode: string;
  from: Date;
}) {
  if (opts.mode === "cod") return { creditDays: 0, dueAt: opts.from };
  const { creditDays } = await getCreditTerms(opts.sellerId, opts.buyerId);
  return { creditDays, dueAt: new Date(opts.from.getTime() + creditDays * 24 * 3600 * 1000) };
}
