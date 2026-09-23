import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CUSTOMER_CONDITIONS } from "@/lib/retail/constants";

export { CUSTOMER_CONDITIONS };
export type { CustomerCondition } from "@/lib/retail/constants";

/**
 * A patient the shop serves. They never sign in — this is the shop's own
 * record, kept under DPDP: consent is captured when the record is created,
 * and "deleting" a customer anonymises them while the bills (accounting
 * records the shop must keep) survive.
 */
const customerSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    /** Year of birth is enough for age-based advice and avoids storing a full DOB. */
    birthYear: Number,
    address: { type: String, trim: true },
    conditions: { type: [String], default: [] },
    notes: { type: String, maxlength: 500 },

    /** DPDP: what the customer agreed to, and when. */
    consent: {
      given: { type: Boolean, default: false },
      at: Date,
      /** Which wording they agreed to, so a change of purpose can be re-consented. */
      version: { type: String, default: "1" },
      /** Reminders are only sent when this is true. */
      reminders: { type: Boolean, default: false },
    },

    loyaltyPoints: { type: Number, default: 0, min: 0 },
    visits: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    firstVisitAt: Date,
    lastVisitAt: Date,

    status: { type: String, enum: ["active", "anonymised"], default: "active" },
    anonymisedAt: Date,
    createdBy: String,
  },
  { timestamps: true },
);
// A phone number identifies a customer within one shop (two shops may both know them).
// Partial, not sparse: a compound sparse index would still index the many
// customers who have no phone — or whose phone was erased — and they'd collide.
customerSchema.index(
  { businessId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);
customerSchema.index({ businessId: 1, name: 1 });
customerSchema.index({ businessId: 1, lastVisitAt: -1 });

export type CustomerDoc = InferSchemaType<typeof customerSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };

export const Customer: Model<CustomerDoc> =
  (mongoose.models.Customer as Model<CustomerDoc>) ?? mongoose.model<CustomerDoc>("Customer", customerSchema);
