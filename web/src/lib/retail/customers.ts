import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Customer, type CustomerDoc } from "@/lib/models/customer";
import { shopSettings } from "@/lib/models/shop-settings";
import { round2 } from "@/lib/orders/gst";
import { medianGap } from "@/lib/retail/cycle";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Version of the consent wording customers agree to; bump it if the text changes. */
export const CONSENT_VERSION = "1";

export type CustomerHit = {
  id: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  visits: number;
  conditions: string[];
  reminders: boolean;
};

export function toHit(c: CustomerDoc): CustomerHit {
  return {
    id: String(c._id),
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    points: c.loyaltyPoints ?? 0,
    visits: c.visits ?? 0,
    conditions: c.conditions ?? [],
    reminders: Boolean(c.consent?.reminders),
  };
}

/** Counter search: a phone number typed in full, or the start of a name. */
export async function searchCustomers(businessId: mongoose.Types.ObjectId, q: string, limit = 8) {
  const term = q.trim();
  if (term.length < 3) return [];
  await connectDB();
  const safe = escapeRegExp(term);
  const rows = await Customer.find({
    businessId,
    status: "active",
    $or: [{ phone: { $regex: `^${safe}` } }, { name: { $regex: safe, $options: "i" } }],
  })
    .sort({ lastVisitAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => toHit(r as CustomerDoc));
}

export type NewCustomer = {
  name: string;
  phone?: string;
  email?: string;
  birthYear?: number;
  address?: string;
  notes?: string;
  conditions?: string[];
  consent: boolean;
  reminders?: boolean;
};

/**
 * Creates a customer, or returns the existing one with that phone number —
 * the counter types a number before it knows whether the person is new.
 */
export async function createCustomer(businessId: mongoose.Types.ObjectId, input: NewCustomer, userId: string) {
  await connectDB();
  if (input.phone) {
    const existing = await Customer.findOne({ businessId, phone: input.phone, status: "active" }).lean();
    if (existing) return { customer: existing as CustomerDoc, created: false };
  }
  const doc = await Customer.create({
    businessId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    birthYear: input.birthYear,
    address: input.address,
    notes: input.notes,
    conditions: input.conditions ?? [],
    consent: {
      given: input.consent,
      at: input.consent ? new Date() : undefined,
      version: CONSENT_VERSION,
      // Reminders need both the record consent and the reminder tick.
      reminders: Boolean(input.consent && input.reminders),
    },
    createdBy: userId,
  });
  return { customer: doc.toObject() as CustomerDoc, created: true };
}

export async function getCustomer(businessId: mongoose.Types.ObjectId, customerId: string) {
  await connectDB();
  return Customer.findOne({ _id: customerId, businessId }).lean();
}

const DAY = 24 * 3600 * 1000;
/** Someone who hasn't been in for this long counts as lapsed. */
export const LAPSED_DAYS = 120;

export type CustomerFilter = "all" | "lapsed" | "reminders" | "chronic";

/** The customer book, filtered the way the shop thinks about it. */
export async function listCustomers(
  businessId: mongoose.Types.ObjectId,
  opts: { q?: string; filter?: CustomerFilter; limit?: number } = {},
) {
  await connectDB();
  const filter: Record<string, unknown> = { businessId, status: "active" };
  if (opts.q) {
    const safe = escapeRegExp(opts.q.trim());
    filter.$or = [{ phone: { $regex: `^${safe}` } }, { name: { $regex: safe, $options: "i" } }];
  }
  if (opts.filter === "lapsed") filter.lastVisitAt = { $lt: new Date(Date.now() - LAPSED_DAYS * DAY) };
  if (opts.filter === "reminders") filter["consent.reminders"] = true;
  if (opts.filter === "chronic") filter.conditions = { $ne: [] };

  return Customer.find(filter).sort({ lastVisitAt: -1, createdAt: -1 }).limit(opts.limit ?? 100).lean();
}

export async function customerStats(businessId: mongoose.Types.ObjectId) {
  await connectDB();
  const lapsedBefore = new Date(Date.now() - LAPSED_DAYS * DAY);
  const [total, reminders, chronic, lapsed] = await Promise.all([
    Customer.countDocuments({ businessId, status: "active" }),
    Customer.countDocuments({ businessId, status: "active", "consent.reminders": true }),
    Customer.countDocuments({ businessId, status: "active", conditions: { $ne: [] } }),
    Customer.countDocuments({ businessId, status: "active", lastVisitAt: { $lt: lapsedBefore } }),
  ]);
  return { total, reminders, chronic, lapsed };
}

export async function updateCustomer(
  businessId: mongoose.Types.ObjectId,
  customerId: string,
  input: NewCustomer,
) {
  await connectDB();
  const current = await Customer.findOne({ _id: customerId, businessId, status: "active" }).lean();
  if (!current) return null;
  await Customer.updateOne(
    { _id: customerId },
    {
      $set: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        birthYear: input.birthYear,
        address: input.address,
        notes: input.notes,
        conditions: input.conditions ?? [],
        "consent.given": input.consent,
        // Re-consent stamps a new date; withdrawing clears the reminder flag.
        "consent.at": input.consent ? (current.consent?.given ? current.consent.at : new Date()) : undefined,
        "consent.version": CONSENT_VERSION,
        "consent.reminders": Boolean(input.consent && input.reminders),
      },
    },
  );
  return Customer.findById(customerId).lean();
}

/**
 * DPDP erasure. The bills stay — a shop must keep its accounts — but every
 * personal detail, including the name printed on old bills, is wiped.
 */
export async function anonymiseCustomer(businessId: mongoose.Types.ObjectId, customerId: string) {
  await connectDB();
  const customer = await Customer.findOne({ _id: customerId, businessId }).lean();
  if (!customer) return null;
  await Customer.updateOne(
    { _id: customerId },
    {
      $set: { name: "Deleted customer", status: "anonymised", anonymisedAt: new Date(), conditions: [] },
      $unset: { phone: 1, email: 1, address: 1, notes: 1, birthYear: 1, consent: 1 },
    },
  );
  await Bill.updateMany({ businessId, customerId }, { $unset: { "customer.name": 1, "customer.phone": 1 } });
  return true;
}

/**
 * Retention: contact details of customers who stopped coming long ago are
 * purged automatically. Runs from the daily cron, per shop.
 */
export async function purgeInactiveCustomers(businessId: mongoose.Types.ObjectId, now = new Date()) {
  const { retentionMonths } = await shopSettings(businessId);
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);
  const stale = await Customer.find(
    { businessId, status: "active", $or: [{ lastVisitAt: { $lt: cutoff } }, { lastVisitAt: null, createdAt: { $lt: cutoff } }] },
    { _id: 1 },
  )
    .limit(500)
    .lean();
  for (const c of stale) await anonymiseCustomer(businessId, String(c._id));
  return stale.length;
}

export type PurchaseRow = {
  productId: string;
  name: string;
  times: number;
  packs: number;
  lastBoughtAt: string;
  /** Typical gap between purchases, in days — null until they have bought twice. */
  medianGapDays: number | null;
};

/** What this customer keeps coming back for, and how often. */
export async function customerPurchases(
  businessId: mongoose.Types.ObjectId,
  customerId: string,
  limit = 40,
): Promise<PurchaseRow[]> {
  await connectDB();
  const bills = await Bill.find(
    { businessId, customerId, status: "final" },
    { lines: 1, createdAt: 1 },
  )
    .sort({ createdAt: 1 })
    .limit(400)
    .lean();

  const byProduct = new Map<string, { name: string; packs: number; dates: Date[] }>();
  for (const b of bills) {
    for (const l of b.lines) {
      const key = String(l.productId);
      const row = byProduct.get(key) ?? { name: l.name, packs: 0, dates: [] };
      row.packs += l.qty;
      row.dates.push(new Date(b.createdAt));
      byProduct.set(key, row);
    }
  }

  return [...byProduct.entries()]
    .map(([productId, row]) => ({
      productId,
      name: row.name,
      times: row.dates.length,
      packs: row.packs,
      lastBoughtAt: row.dates[row.dates.length - 1].toISOString(),
      medianGapDays: medianGap(row.dates),
    }))
    .sort((a, b) => b.times - a.times || b.lastBoughtAt.localeCompare(a.lastBoughtAt))
    .slice(0, limit);
}

/** Spend and visit summary for the profile header. */
export async function customerSummary(businessId: mongoose.Types.ObjectId, customerId: string) {
  await connectDB();
  const [row] = await Bill.aggregate<{ bills: number; spend: number; last: Date }>([
    { $match: { businessId, customerId: new mongoose.Types.ObjectId(customerId), status: "final" } },
    { $group: { _id: null, bills: { $sum: 1 }, spend: { $sum: "$totals.grandTotal" }, last: { $max: "$createdAt" } } },
  ]);
  const bills = row?.bills ?? 0;
  const spend = round2(row?.spend ?? 0);
  return { bills, spend, average: bills ? round2(spend / bills) : 0, lastVisitAt: row?.last ?? null };
}
