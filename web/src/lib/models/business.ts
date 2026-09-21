import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BUSINESS_TYPES } from "@/lib/permissions";
import { STATE_CODES } from "@/lib/india";

export const KYC_STATUSES = ["draft", "pending", "approved", "rejected", "suspended"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const DOCUMENT_KINDS = [
  "gst_certificate",
  "drug_license",
  "pan_card",
  "pharmacist_certificate",
  "manufacturing_license",
  "fssai_license",
  "shop_photo",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Documents each business type must upload before it can submit KYC. */
export const REQUIRED_DOCUMENTS: Record<(typeof BUSINESS_TYPES)[number], DocumentKind[]> = {
  retailer: ["gst_certificate", "drug_license", "pan_card", "pharmacist_certificate"],
  wholesaler: ["gst_certificate", "drug_license", "pan_card"],
  company: ["gst_certificate", "manufacturing_license", "pan_card"],
};

const addressSchema = new Schema(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, trim: true },
    stateCode: { type: String, required: true, enum: STATE_CODES },
    pincode: { type: String, required: true, match: /^[1-9][0-9]{5}$/ },
  },
  { _id: false },
);

const licenseSchema = new Schema(
  {
    // e.g. "20B", "21B" (wholesale), "20", "21" (retail), "25", "28" (manufacturing)
    form: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true, uppercase: true },
    validTill: { type: Date, required: true },
  },
  { _id: false },
);

const documentSchema = new Schema(
  {
    kind: { type: String, enum: DOCUMENT_KINDS, required: true },
    // Cloudinary public_id of an "authenticated" asset; never a public URL.
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ["image", "raw"], required: true },
    format: String,
    originalName: String,
    bytes: Number,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, required: true },
  },
  { _id: true },
);

const businessSchema = new Schema(
  {
    type: { type: String, enum: BUSINESS_TYPES, required: true, index: true },
    legalName: { type: String, required: true, trim: true },
    tradeName: { type: String, trim: true },
    gstin: { type: String, uppercase: true, trim: true, sparse: true, unique: true },
    pan: { type: String, uppercase: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: addressSchema,

    drugLicenses: { type: [licenseSchema], default: [] },
    // Retailers must name a registered pharmacist.
    pharmacist: {
      name: { type: String, trim: true },
      registrationNumber: { type: String, trim: true, uppercase: true },
    },
    fssaiNumber: { type: String, trim: true },

    documents: { type: [documentSchema], default: [] },

    kyc: {
      status: { type: String, enum: KYC_STATUSES, default: "draft", index: true },
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: String,
      remarks: String,
    },

    ownerUserId: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

businessSchema.index({ "kyc.status": 1, "kyc.submittedAt": 1 });

export type BusinessDoc = InferSchemaType<typeof businessSchema> & { _id: mongoose.Types.ObjectId };

export const Business: Model<BusinessDoc> =
  (mongoose.models.Business as Model<BusinessDoc>) ?? mongoose.model<BusinessDoc>("Business", businessSchema);
