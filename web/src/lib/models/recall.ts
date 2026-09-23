import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { RECALL_SEVERITIES } from "@/lib/recalls/constants";

export { RECALL_SEVERITIES };
export type { RecallSeverity } from "@/lib/recalls/constants";

/**
 * A batch pulled from the market (CDSCO / manufacturer notice). Issuing one
 * holds every matching listing and warns the sellers and the buyers who
 * already received that batch.
 */
const recallSchema = new Schema(
  {
    productName: { type: String, required: true, trim: true },
    manufacturer: { type: String, trim: true },
    /** Batches are matched on this, case-insensitively (listings store it uppercase). */
    batchNo: { type: String, required: true, trim: true, uppercase: true },
    severity: { type: String, enum: RECALL_SEVERITIES, default: "recall" },
    reason: { type: String, required: true, maxlength: 1000 },
    /** CDSCO notice number, alert link or similar. */
    reference: { type: String, maxlength: 300 },
    status: { type: String, enum: ["active", "withdrawn"], default: "active" },
    issuedBy: { type: String, required: true },
    issuedByName: String,
    withdrawnAt: Date,
    withdrawnBy: String,
    /** What the broadcast touched, kept for the admin list. */
    stats: {
      listings: { type: Number, default: 0 },
      sellers: { type: Number, default: 0 },
      orders: { type: Number, default: 0 },
      buyers: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);
recallSchema.index({ batchNo: 1, status: 1 });
recallSchema.index({ createdAt: -1 });

export type RecallDoc = InferSchemaType<typeof recallSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };

export const Recall: Model<RecallDoc> =
  (mongoose.models.Recall as Model<RecallDoc>) ?? mongoose.model<RecallDoc>("Recall", recallSchema);
