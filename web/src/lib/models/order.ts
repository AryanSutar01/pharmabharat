import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ORDER_STATUSES, PAYMENT_MODES } from "@/lib/orders/status";

/** Party details frozen at order time — invoices must not change if a profile is edited later. */
const partySchema = new Schema(
  {
    name: { type: String, required: true },
    gstin: String,
    pan: String,
    phone: String,
    email: String,
    address: String,
    stateCode: { type: String, required: true },
    drugLicenses: String,
  },
  { _id: false },
);

const itemSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    manufacturer: String,
    packSizeLabel: String,
    batchNo: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    hsn: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    mrp: { type: Number, required: true },
    price: { type: Number, required: true },
    gstRate: { type: Number, required: true },
    taxable: { type: Number, required: true },
    cgst: { type: Number, required: true },
    sgst: { type: Number, required: true },
    igst: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    // All orders created by one checkout share a groupId (one per seller).
    groupId: { type: String, required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    placedBy: { type: String, required: true },
    buyer: { type: partySchema, required: true },
    seller: { type: partySchema, required: true },
    interState: { type: Boolean, required: true },

    items: { type: [itemSchema], required: true },
    totals: {
      taxable: { type: Number, required: true },
      cgst: { type: Number, required: true },
      sgst: { type: Number, required: true },
      igst: { type: Number, required: true },
      tax: { type: Number, required: true },
      roundOff: { type: Number, required: true },
      grandTotal: { type: Number, required: true },
    },

    status: { type: String, enum: ORDER_STATUSES, default: "placed" },
    history: {
      type: [
        {
          _id: false,
          status: { type: String, enum: ORDER_STATUSES, required: true },
          at: { type: Date, default: Date.now },
          by: String,
          note: String,
        },
      ],
      default: [],
    },
    notes: { type: String, maxlength: 500 },

    payment: {
      mode: { type: String, enum: PAYMENT_MODES, required: true },
      status: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid" },
      // Running total of receipts allocated to this order (see lib/ledger).
      paidAmount: { type: Number, default: 0 },
      paidAt: Date,
      /** Credit terms frozen at order time; due = invoice date + creditDays. */
      creditDays: { type: Number, default: 0 },
      dueAt: Date,
      /** Last overdue reminder sent (keeps the daily job from nagging). */
      reminderAt: Date,
    },
    // Assigned when the seller accepts: sequential per seller per financial year.
    invoice: { number: String, date: Date },
  },
  { timestamps: true },
);

orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof orderSchema> & { _id: mongoose.Types.ObjectId };

export const Order: Model<OrderDoc> =
  (mongoose.models.Order as Model<OrderDoc>) ?? mongoose.model<OrderDoc>("Order", orderSchema);

/** Atomic sequences (order numbers, invoice numbers). */
const counterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });
export const Counter: Model<{ _id: string; seq: number }> =
  (mongoose.models.Counter as Model<{ _id: string; seq: number }>) ??
  mongoose.model<{ _id: string; seq: number }>("Counter", counterSchema);

export async function nextSequence(key: string, session?: mongoose.ClientSession) {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  ).lean();
  return doc!.seq;
}
