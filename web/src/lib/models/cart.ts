import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** One cart per (buyer business, user): staff members don't overwrite each other's carts. */
const cartSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    userId: { type: String, required: true },
    items: {
      type: [
        {
          _id: false,
          listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
          qty: { type: Number, required: true, min: 1 },
          addedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

cartSchema.index({ businessId: 1, userId: 1 }, { unique: true });

export type CartDoc = InferSchemaType<typeof cartSchema> & { _id: mongoose.Types.ObjectId };

export const Cart: Model<CartDoc> =
  (mongoose.models.Cart as Model<CartDoc>) ?? mongoose.model<CartDoc>("Cart", cartSchema);
