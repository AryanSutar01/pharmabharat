import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  CALLBACK_SLOTS,
  TICKET_CATEGORIES,
  TICKET_KINDS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "@/lib/support/constants";

const ticketSchema = new Schema(
  {
    number: { type: String, required: true, unique: true }, // TKT-000123
    kind: { type: String, enum: TICKET_KINDS, default: "ticket" },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    businessName: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: "normal" },
    subject: { type: String, required: true, maxlength: 150 },
    orderNo: { type: String, maxlength: 30 },
    callback: {
      phone: String,
      slot: { type: String, enum: [...CALLBACK_SLOTS, null] },
      language: { type: String, enum: ["en", "hi", "mr", null] },
    },
    status: { type: String, enum: TICKET_STATUSES, default: "open" },
    assigneeUserId: String,
    assigneeName: String,
    replies: {
      type: [
        {
          authorUserId: { type: String, required: true },
          authorName: { type: String, required: true },
          fromSupport: { type: Boolean, default: false },
          text: { type: String, required: true, maxlength: 5000 },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

ticketSchema.index({ businessId: 1, lastActivityAt: -1 });
ticketSchema.index({ status: 1, priority: 1, lastActivityAt: -1 });

export type TicketDoc = InferSchemaType<typeof ticketSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };

export const Ticket: Model<TicketDoc> =
  (mongoose.models.Ticket as Model<TicketDoc>) ?? mongoose.model<TicketDoc>("Ticket", ticketSchema);
