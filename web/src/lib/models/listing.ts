import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { DRUG_SCHEDULES, GST_RATES, STORAGE_CONDITIONS } from "@/lib/catalog/constants";

/**
 * A seller's offer: one batch of one product at one price.
 * Selling price is per pack (same unit as MRP) and GST-exclusive.
 */
const listingSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },

    batchNo: { type: String, required: true, trim: true, uppercase: true },
    mfgDate: Date,
    expiryDate: { type: Date, required: true },

    mrp: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, enum: GST_RATES, required: true },
    hsn: { type: String, required: true, trim: true },

    stock: { type: Number, required: true, min: 0, default: 0 },
    minOrderQty: { type: Number, min: 1, default: 1 },

    storage: { type: String, enum: STORAGE_CONDITIONS, default: "room" },
    schedule: { type: String, enum: DRUG_SCHEDULES, required: true },
    // Seller-chosen condition tags, in addition to those derived from salts.
    conditions: { type: [String], default: [] },

    status: { type: String, enum: ["active", "paused"], default: "active" },
    // Admin moderation: a held listing stays paused until an admin releases it.
    moderation: {
      held: { type: Boolean, default: false },
      reason: String,
      by: String,
      at: Date,
    },
    // Last near-expiry warning sent for this batch (90 / 60 / 30 days); see lib/alerts/expiry.ts.
    expiryAlertLevel: { type: Number, enum: [90, 60, 30, null], default: null },
    // Denormalised for filtering/sorting without a join.
    sellerStateCode: { type: String, required: true },
  },
  { timestamps: true },
);

listingSchema.index({ productId: 1, status: 1, price: 1 });
listingSchema.index({ sellerId: 1, productId: 1, batchNo: 1 }, { unique: true });
listingSchema.index({ sellerId: 1, expiryDate: 1 });

export type ListingDoc = InferSchemaType<typeof listingSchema> & { _id: mongoose.Types.ObjectId };

export const Listing: Model<ListingDoc> =
  (mongoose.models.Listing as Model<ListingDoc>) ?? mongoose.model<ListingDoc>("Listing", listingSchema);
