import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const BANNER_AUDIENCES = ["all", "retailer", "wholesaler", "company"] as const;
export const BANNER_TONES = ["info", "success", "warning"] as const;

/** Announcement shown on the app home page, targeted by business type. */
const bannerSchema = new Schema(
  {
    title: { en: { type: String, required: true, maxlength: 120 }, hi: String, mr: String },
    body: { en: { type: String, maxlength: 400 }, hi: String, mr: String },
    link: { type: String, maxlength: 300 },
    audience: { type: String, enum: BANNER_AUDIENCES, default: "all" },
    tone: { type: String, enum: BANNER_TONES, default: "info" },
    active: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
    createdBy: String,
  },
  { timestamps: true },
);

export type BannerDoc = InferSchemaType<typeof bannerSchema> & { _id: mongoose.Types.ObjectId };

export const Banner: Model<BannerDoc> =
  (mongoose.models.Banner as Model<BannerDoc>) ?? mongoose.model<BannerDoc>("Banner", bannerSchema);
