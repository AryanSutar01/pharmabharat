import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { GST_RATES } from "@/lib/catalog/constants";
import { BILL_PAYMENT_MODES } from "@/lib/retail/constants";
import { TAX_STATUSES } from "@/lib/tax-status";

export { BILL_PAYMENT_MODES };
export type { BillPaymentMode } from "@/lib/retail/constants";

/**
 * A counter sale. Lines are frozen copies of the batch that was handed over,
 * because the shelf row can be topped up or written off afterwards — and a
 * dispensing record has to stay true to what was sold (Schedule H1 register).
 */
const billLineSchema = new Schema(
  {
    stockId: { type: Schema.Types.ObjectId, ref: "ShopStock", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    packSizeLabel: String,
    batchNo: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    hsn: String,
    schedule: String,
    /** How many of `saleUnit` were handed over: 2 strips, or 4 tablets. */
    qty: { type: Number, required: true, min: 1 },
    saleUnit: { type: String, enum: ["pack", "unit"], default: "pack" },
    unitsPerPack: { type: Number, default: 1, min: 1 },
    /** What came off the shelf, always in the smallest sellable unit. */
    units: { type: Number, required: true, min: 1 },
    /** Charged per `saleUnit`: the strip MRP, or the per-tablet price. */
    rate: { type: Number, required: true, min: 0 },
    /** Printed MRP per pack — GST is inside it (see lib/retail/gst.ts). */
    mrp: { type: Number, required: true, min: 0 },
    /** What the shop paid per pack, copied so margin reports don't need the shelf row. */
    cost: { type: Number, default: 0 },
    gstRate: { type: Number, enum: GST_RATES, required: true },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    gross: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    taxable: { type: Number, required: true },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
  },
  { _id: false },
);

const billSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    billNo: { type: String, required: true },
    /**
     * Frozen at the time of sale, like the line items: if the shop registers
     * for GST later, an old bill of supply must still read as one.
     */
    documentType: { type: String, enum: ["tax_invoice", "bill_of_supply"], default: "tax_invoice" },
    /** The shop's GST position when this bill was raised. */
    taxStatus: { type: String, enum: TAX_STATUSES, default: "registered" },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    /** Name and phone as printed, kept even if the customer is later anonymised. */
    customer: { name: String, phone: String },

    lines: { type: [billLineSchema], required: true },
    totals: {
      gross: Number,
      discount: Number,
      taxable: Number,
      cgst: Number,
      sgst: Number,
      tax: Number,
      redeemed: Number,
      roundOff: Number,
      grandTotal: { type: Number, required: true },
    },
    /** Purchase cost of everything sold, for the margin reports. */
    costTotal: { type: Number, default: 0 },

    payment: {
      mode: { type: String, enum: BILL_PAYMENT_MODES, default: "cash" },
      received: Number,
    },
    loyalty: {
      earned: { type: Number, default: 0 },
      redeemed: { type: Number, default: 0 },
      value: { type: Number, default: 0 },
    },
    /** Filled when a Schedule H/H1 medicine is dispensed. */
    prescription: {
      doctorName: String,
      registrationNo: String,
      date: Date,
      patientName: String,
    },

    status: { type: String, enum: ["final", "cancelled"], default: "final" },
    cancelledAt: Date,
    cancelledBy: String,
    createdBy: { type: String, required: true },
    createdByName: String,
  },
  { timestamps: true },
);
billSchema.index({ businessId: 1, billNo: 1 }, { unique: true });
billSchema.index({ businessId: 1, createdAt: -1 });
billSchema.index({ businessId: 1, customerId: 1, createdAt: -1 });
billSchema.index({ businessId: 1, "lines.productId": 1, createdAt: -1 });

export type BillDoc = InferSchemaType<typeof billSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };

export const Bill: Model<BillDoc> =
  (mongoose.models.Bill as Model<BillDoc>) ?? mongoose.model<BillDoc>("Bill", billSchema);
