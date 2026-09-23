import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PAYMENT_METHODS } from "@/lib/ledger/constants";

export { PAYMENT_METHODS };
export type { PaymentMethod } from "@/lib/ledger/constants";

/** Credit terms a seller gives one buyer. Absent = no limit, pay on the seller's usual terms. */
const creditAccountSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    /** Maximum unpaid amount allowed, in rupees. 0 / unset = no limit. */
    creditLimit: { type: Number, min: 0, default: 0 },
    /** Days after the invoice date that payment is due. */
    creditDays: { type: Number, min: 0, max: 180, default: 30 },
    note: { type: String, maxlength: 300 },
    updatedBy: String,
  },
  { timestamps: true },
);
creditAccountSchema.index({ sellerId: 1, buyerId: 1 }, { unique: true });

export type CreditAccountDoc = InferSchemaType<typeof creditAccountSchema> & { _id: mongoose.Types.ObjectId };
export const CreditAccount: Model<CreditAccountDoc> =
  (mongoose.models.CreditAccount as Model<CreditAccountDoc>) ??
  mongoose.model<CreditAccountDoc>("CreditAccount", creditAccountSchema);

/**
 * A receipt the seller records against a buyer's account. Allocated to the
 * oldest unpaid invoices first; `allocations` keeps that split for the statement.
 */
const paymentSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    reference: { type: String, maxlength: 80 },
    note: { type: String, maxlength: 300 },
    receivedAt: { type: Date, default: Date.now },
    recordedBy: { type: String, required: true },
    recordedByName: String,
    allocations: {
      type: [{ _id: false, orderId: { type: Schema.Types.ObjectId, ref: "Order" }, orderNo: String, amount: Number }],
      default: [],
    },
    /** Part of the receipt that no open invoice needed (advance / on account). */
    unallocated: { type: Number, default: 0 },
  },
  { timestamps: true },
);
paymentSchema.index({ sellerId: 1, buyerId: 1, receivedAt: -1 });
paymentSchema.index({ buyerId: 1, receivedAt: -1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const Payment: Model<PaymentDoc> =
  (mongoose.models.Payment as Model<PaymentDoc>) ?? mongoose.model<PaymentDoc>("Payment", paymentSchema);
