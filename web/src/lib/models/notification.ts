import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const NOTIFICATION_KINDS = [
  "price_drop",
  "price_rise",
  "expiry_soon",
  "order_placed",
  "order_status",
  "kyc_decision",
  "support_update",
  "payment_recorded",
  "payment_due",
  "batch_recall",
  "licence_expiring",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * In-app notification for one user in one business. Stores a kind + params,
 * not rendered text, so it shows in whatever language the viewer uses.
 */
const notificationSchema = new Schema(
  {
    userId: { type: String, required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    link: String,
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ userId: 1, businessId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, businessId: 1, readAt: 1 });
// Keep the free-tier database small: notifications expire after 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const Notification: Model<NotificationDoc> =
  (mongoose.models.Notification as Model<NotificationDoc>) ??
  mongoose.model<NotificationDoc>("Notification", notificationSchema);
