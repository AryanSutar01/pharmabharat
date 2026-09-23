import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { GST_RATES } from "@/lib/catalog/constants";

export const STOCK_SOURCES = ["order", "manual", "csv"] as const;
export type StockSource = (typeof STOCK_SOURCES)[number];

/**
 * One batch on a medical shop's own shelf.
 *
 * Quantity is held in the **smallest sellable unit** — a tablet, a capsule —
 * because a chemist cuts strips all day. `unitsPerPack` says how many of those
 * make one pack; it is 1 for anything that cannot be split (a syrup bottle, an
 * injection), and such a batch behaves exactly as a whole pack.
 *
 * `cost` and `mrp` stay **per pack**: that is what the invoice and the foil say.
 * Per-unit money is derived (see lib/retail/units.ts).
 */
const shopStockSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    /** Frozen so the shelf still reads correctly if the catalogue entry changes. */
    name: { type: String, required: true, trim: true },
    manufacturer: { type: String, trim: true },
    packSizeLabel: { type: String, trim: true },

    batchNo: { type: String, required: true, trim: true, uppercase: true },
    expiryDate: { type: Date, required: true },
    mfgDate: Date,

    /** On the shelf, in the smallest sellable unit. */
    units: { type: Number, required: true, min: 0, default: 0 },
    /** Units in one pack: 15 for a strip of 15, 1 for a bottle. */
    unitsPerPack: { type: Number, required: true, min: 1, default: 1 },
    /** Purchase rate per pack, excluding GST. Drives the margin reports. */
    cost: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, enum: GST_RATES, required: true },
    hsn: { type: String, trim: true },
    schedule: { type: String, trim: true },

    /** Last expiry warning sent for this batch (90 / 60 / 30 days). */
    expiryAlertLevel: { type: Number, enum: [90, 60, 30, null], default: null },

    source: { type: String, enum: STOCK_SOURCES, default: "manual" },
    /** Where it came from: a PharmaBharat order, or a supplier typed by hand. */
    supplierId: { type: Schema.Types.ObjectId, ref: "Business" },
    supplierName: { type: String, trim: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    receivedAt: { type: Date, default: Date.now },
    addedBy: String,
  },
  { timestamps: true },
);
// One row per shop × product × batch, so receiving the same batch twice tops it up.
shopStockSchema.index({ businessId: 1, productId: 1, batchNo: 1 }, { unique: true });
shopStockSchema.index({ businessId: 1, expiryDate: 1 });
shopStockSchema.index({ businessId: 1, orderId: 1 });

export type ShopStockDoc = InferSchemaType<typeof shopStockSchema> & { _id: mongoose.Types.ObjectId };

export const ShopStock: Model<ShopStockDoc> =
  (mongoose.models.ShopStock as Model<ShopStockDoc>) ?? mongoose.model<ShopStockDoc>("ShopStock", shopStockSchema);

/**
 * Per-product shop settings and the sales speed the nightly job works out.
 * Kept apart from the batches so a reorder level survives going out of stock.
 */
const shopItemSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true, trim: true },
    /** Packs sold per day over the recent window (computed nightly). */
    dailySales: { type: Number, default: 0 },
    /** Reorder level in packs. Computed from dailySales unless the shop set one. */
    reorderLevel: { type: Number, default: 0, min: 0 },
    manualReorderLevel: { type: Boolean, default: false },
    lastSoldAt: Date,
    computedAt: Date,
  },
  { timestamps: true },
);
shopItemSchema.index({ businessId: 1, productId: 1 }, { unique: true });

export type ShopItemDoc = InferSchemaType<typeof shopItemSchema> & { _id: mongoose.Types.ObjectId };

export const ShopItem: Model<ShopItemDoc> =
  (mongoose.models.ShopItem as Model<ShopItemDoc>) ?? mongoose.model<ShopItemDoc>("ShopItem", shopItemSchema);
