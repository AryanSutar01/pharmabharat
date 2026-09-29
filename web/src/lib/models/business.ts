import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BUSINESS_TYPES } from "@/lib/permissions";
import { STATE_CODES } from "@/lib/india";
import { TAX_STATUSES, needsGstin, type TaxStatus } from "@/lib/tax-status";

export const KYC_STATUSES = ["draft", "pending", "approved", "rejected", "suspended"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export { TAX_STATUSES, collectsGst, needsGstin, documentTypeFor, COMPOSITION_DECLARATION } from "@/lib/tax-status";
export type { TaxStatus, SalesDocumentType } from "@/lib/tax-status";

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

/**
 * Documents each business type must upload before it can submit KYC.
 * The GST certificate is only asked of businesses that actually hold a GSTIN —
 * a shop below the registration threshold has none to give. The drug licence is
 * never optional: GST is a turnover question, selling medicine is not.
 */
const BASE_DOCUMENTS: Record<(typeof BUSINESS_TYPES)[number], DocumentKind[]> = {
  retailer: ["drug_license", "pan_card", "pharmacist_certificate"],
  wholesaler: ["drug_license", "pan_card"],
  company: ["manufacturing_license", "pan_card"],
};

export function requiredDocuments(type: (typeof BUSINESS_TYPES)[number], taxStatus?: TaxStatus): DocumentKind[] {
  const base = BASE_DOCUMENTS[type];
  return needsGstin(taxStatus) ? (["gst_certificate", ...base] as DocumentKind[]) : [...base];
}

/** Kept for call sites that only care about the fully registered case. */
export const REQUIRED_DOCUMENTS: Record<(typeof BUSINESS_TYPES)[number], DocumentKind[]> = {
  retailer: requiredDocuments("retailer"),
  wholesaler: requiredDocuments("wholesaler"),
  company: requiredDocuments("company"),
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
    /** Registered, registered under composition, or below the threshold. */
    taxStatus: { type: String, enum: TAX_STATUSES, default: "registered" },
    /** Absent for an unregistered business — never an empty string (see the index). */
    gstin: { type: String, uppercase: true, trim: true },
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

    // Licence-expiry enforcement (see lib/compliance).
    compliance: {
      /** Last warning level sent (60 / 30 / 7 days); reset when the licence is renewed. */
      licenceWarnLevel: { type: Number, enum: [60, 30, 7, null], default: null },
      suspendedAt: Date,
    },

    ownerUserId: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

businessSchema.index({ "kyc.status": 1, "kyc.submittedAt": 1 });
// Partial, not sparse: unregistered businesses have no GSTIN at all, and an
// empty string must not count as one either, or the second one would collide.
businessSchema.index(
  { gstin: 1 },
  { unique: true, partialFilterExpression: { gstin: { $type: "string", $gt: "" } } },
);

export type BusinessDoc = InferSchemaType<typeof businessSchema> & { _id: mongoose.Types.ObjectId };

export const Business: Model<BusinessDoc> =
  (mongoose.models.Business as Model<BusinessDoc>) ?? mongoose.model<BusinessDoc>("Business", businessSchema);
