import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MEMBER_ROLES } from "@/lib/permissions";

const membershipSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: MEMBER_ROLES, required: true },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    invitedBy: String,
  },
  { timestamps: true },
);

membershipSchema.index({ businessId: 1, userId: 1 }, { unique: true });

export type MembershipDoc = InferSchemaType<typeof membershipSchema> & { _id: mongoose.Types.ObjectId };

export const Membership: Model<MembershipDoc> =
  (mongoose.models.Membership as Model<MembershipDoc>) ??
  mongoose.model<MembershipDoc>("Membership", membershipSchema);

const invitationSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: MEMBER_ROLES, required: true },
    // sha256 of the token that was emailed; the raw token is never stored.
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },
    invitedBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    acceptedBy: String,
  },
  { timestamps: true },
);

invitationSchema.index({ businessId: 1, email: 1, status: 1 });

export type InvitationDoc = InferSchemaType<typeof invitationSchema> & { _id: mongoose.Types.ObjectId };

export const Invitation: Model<InvitationDoc> =
  (mongoose.models.Invitation as Model<InvitationDoc>) ??
  mongoose.model<InvitationDoc>("Invitation", invitationSchema);
