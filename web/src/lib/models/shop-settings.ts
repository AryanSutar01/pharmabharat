import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const SHOP_DEFAULTS = {
  /** Reorder level covers this many days of typical sales. */
  reorderCoverDays: 15,
  /** Inactive customers' contact details are purged after this long (DPDP). */
  retentionMonths: 36,
  /** Loose tablets: round the per-tablet price up to the paisa, or keep it exact. */
  looseRounding: "up",
  /** Loyalty: points earned per rupee spent, and what a point is worth. */
  pointsPerHundred: 1,
  pointValue: 1,
  minRedeemPoints: 100,
  pointExpiryMonths: 12,
} as const;

/** One settings document per shop. Everything has a sensible default. */
const shopSettingsSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, unique: true },
    reorderCoverDays: { type: Number, default: SHOP_DEFAULTS.reorderCoverDays, min: 1, max: 120 },
    retentionMonths: { type: Number, default: SHOP_DEFAULTS.retentionMonths, min: 6, max: 120 },
    looseRounding: { type: String, enum: ["up", "exact"], default: SHOP_DEFAULTS.looseRounding },
    loyalty: {
      active: { type: Boolean, default: false },
      pointsPerHundred: { type: Number, default: SHOP_DEFAULTS.pointsPerHundred, min: 0, max: 100 },
      pointValue: { type: Number, default: SHOP_DEFAULTS.pointValue, min: 0, max: 100 },
      minRedeemPoints: { type: Number, default: SHOP_DEFAULTS.minRedeemPoints, min: 0, max: 100_000 },
      expiryMonths: { type: Number, default: SHOP_DEFAULTS.pointExpiryMonths, min: 1, max: 120 },
    },
    updatedBy: String,
  },
  { timestamps: true },
);

export type ShopSettingsDoc = InferSchemaType<typeof shopSettingsSchema> & { _id: mongoose.Types.ObjectId };

export const ShopSettings: Model<ShopSettingsDoc> =
  (mongoose.models.ShopSettings as Model<ShopSettingsDoc>) ??
  mongoose.model<ShopSettingsDoc>("ShopSettings", shopSettingsSchema);

/** Settings with defaults filled in, for code that just wants the numbers. */
export async function shopSettings(businessId: mongoose.Types.ObjectId) {
  const doc = await ShopSettings.findOne({ businessId }).lean();
  return {
    reorderCoverDays: doc?.reorderCoverDays ?? SHOP_DEFAULTS.reorderCoverDays,
    retentionMonths: doc?.retentionMonths ?? SHOP_DEFAULTS.retentionMonths,
    looseRounding: (doc?.looseRounding ?? SHOP_DEFAULTS.looseRounding) as "up" | "exact",
    loyalty: {
      active: doc?.loyalty?.active ?? false,
      pointsPerHundred: doc?.loyalty?.pointsPerHundred ?? SHOP_DEFAULTS.pointsPerHundred,
      pointValue: doc?.loyalty?.pointValue ?? SHOP_DEFAULTS.pointValue,
      minRedeemPoints: doc?.loyalty?.minRedeemPoints ?? SHOP_DEFAULTS.minRedeemPoints,
      expiryMonths: doc?.loyalty?.expiryMonths ?? SHOP_DEFAULTS.pointExpiryMonths,
    },
  };
}
