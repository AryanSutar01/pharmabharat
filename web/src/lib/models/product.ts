import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { DOSAGE_FORMS } from "@/lib/catalog/normalize";

export const PRODUCT_SOURCES = ["dataset", "seller", "company"] as const;

/**
 * Medicine master: one document per brand + strength + pack.
 * Prices on this document are the reference MRP only; what sellers actually
 * charge lives on Listing.
 */
const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    manufacturer: { type: String, required: true, trim: true },
    form: { type: String, enum: DOSAGE_FORMS, default: "other" },
    packSizeLabel: { type: String, trim: true },
    mrp: { type: Number, min: 0 },
    ingredients: {
      type: [{ _id: false, salt: { type: String, required: true }, strength: { type: String, default: "" } }],
      default: [],
    },
    // "amoxycillin 500mg + clavulanic acid 125mg" — equal keys are substitutes.
    compositionKey: { type: String, index: true },
    // "amoxycillin + clavulanic acid" — same salts, any strength.
    saltKey: { type: String, index: true },
    // Lower-case salt names; searched through the Atlas Search index.
    salts: { type: [String], default: [] },
    conditions: { type: [String], index: true },

    // Regulatory / tax defaults a seller can override per listing.
    hsn: { type: String, trim: true },
    gstRate: { type: Number, enum: [0, 5, 12, 18, 28] },
    schedule: { type: String, enum: ["otc", "h", "h1", "x", "g", "unknown"], default: "unknown" },

    source: { type: String, enum: PRODUCT_SOURCES, required: true },
    sourceId: { type: String, unique: true, sparse: true },
    createdByBusinessId: { type: Schema.Types.ObjectId, ref: "Business" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Exact, case-insensitive name lookup (CSV import). Query with the same collation.
export const NAME_COLLATION = { locale: "en", strength: 2 } as const;
productSchema.index({ name: 1 }, { collation: NAME_COLLATION });

// Text search uses the Atlas Search index defined in src/lib/catalog/search-index.ts
// (fuzzy + autocomplete), not a MongoDB $text index, to save M0 storage.

export type ProductDoc = InferSchemaType<typeof productSchema> & { _id: mongoose.Types.ObjectId };

export const Product: Model<ProductDoc> =
  (mongoose.models.Product as Model<ProductDoc>) ?? mongoose.model<ProductDoc>("Product", productSchema);
