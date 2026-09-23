import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * One refill we have already chased, so the customer isn't emailed twice and
 * the counter's call-list doesn't keep showing someone who has been rung.
 * Keyed by the due date, so the next cycle starts a fresh row.
 */
const refillNudgeSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    /** The due date this nudge belongs to (day precision). */
    dueOn: { type: String, required: true },
    emailedAt: Date,
    /** Set when someone at the counter ticks "called". */
    contactedAt: Date,
    contactedBy: String,
  },
  { timestamps: true },
);
refillNudgeSchema.index({ businessId: 1, customerId: 1, productId: 1, dueOn: 1 }, { unique: true });

export type RefillNudgeDoc = InferSchemaType<typeof refillNudgeSchema> & { _id: mongoose.Types.ObjectId };

export const RefillNudge: Model<RefillNudgeDoc> =
  (mongoose.models.RefillNudge as Model<RefillNudgeDoc>) ??
  mongoose.model<RefillNudgeDoc>("RefillNudge", refillNudgeSchema);
