import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const LOYALTY_KINDS = ["earned", "redeemed", "expired", "adjusted"] as const;
export type LoyaltyKind = (typeof LOYALTY_KINDS)[number];

/**
 * One movement of loyalty points. The customer's balance is the sum of these,
 * kept denormalised on the customer for speed; this ledger is the truth and
 * is what point expiry is worked out from.
 */
const loyaltyEntrySchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    billId: { type: Schema.Types.ObjectId, ref: "Bill" },
    kind: { type: String, enum: LOYALTY_KINDS, required: true },
    /** Positive when earned or adjusted up, negative when redeemed or expired. */
    points: { type: Number, required: true },
    /** Rupee value, for redemptions. */
    value: { type: Number, default: 0 },
    /** Earned points lapse on this date if unused. */
    expiresAt: Date,
    note: String,
    createdBy: String,
  },
  { timestamps: true },
);
loyaltyEntrySchema.index({ businessId: 1, customerId: 1, createdAt: 1 });

export type LoyaltyEntryDoc = InferSchemaType<typeof loyaltyEntrySchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const LoyaltyEntry: Model<LoyaltyEntryDoc> =
  (mongoose.models.LoyaltyEntry as Model<LoyaltyEntryDoc>) ??
  mongoose.model<LoyaltyEntryDoc>("LoyaltyEntry", loyaltyEntrySchema);
