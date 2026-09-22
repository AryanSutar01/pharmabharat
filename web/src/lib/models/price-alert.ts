import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PRICE_DIRECTIONS } from "@/lib/alerts/rules";

/** A user's subscription to best-price changes on one product. */
const priceAlertSchema = new Schema(
  {
    userId: { type: String, required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    direction: { type: String, enum: PRICE_DIRECTIONS, default: "drop" },
    thresholdPct: { type: Number, min: 0, max: 90, default: 0 },
    email: { type: Boolean, default: true },
    // Best price when subscribed (null if no sellers yet); then the price at the last alert.
    referencePrice: { type: Number, default: null },
    lastNotifiedAt: Date,
  },
  { timestamps: true },
);

priceAlertSchema.index({ userId: 1, businessId: 1, productId: 1 }, { unique: true });
priceAlertSchema.index({ productId: 1 });

export type PriceAlertDoc = InferSchemaType<typeof priceAlertSchema> & { _id: mongoose.Types.ObjectId };

export const PriceAlert: Model<PriceAlertDoc> =
  (mongoose.models.PriceAlert as Model<PriceAlertDoc>) ??
  mongoose.model<PriceAlertDoc>("PriceAlert", priceAlertSchema);
