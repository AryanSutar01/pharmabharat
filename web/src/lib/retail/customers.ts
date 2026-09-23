import "server-only";
import type mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Customer, type CustomerDoc } from "@/lib/models/customer";

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
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
