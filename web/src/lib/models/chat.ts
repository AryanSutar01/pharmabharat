import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * A chat thread. "direct" = exactly two businesses; "community" = an open room
 * (all-India, or one per state) that every approved business in scope can read;
 * "support" = one business and the PharmaBharat support team.
 */
const conversationSchema = new Schema(
  {
    type: { type: String, enum: ["direct", "community", "support"], required: true },
    participants: { type: [Schema.Types.ObjectId], ref: "Business", default: [] },
    // Sorted "idA:idB" for direct chats, "support:<businessId>" for the support
    // thread — guarantees one thread per pair.
    pairKey: { type: String, unique: true, sparse: true },
    // Community rooms: "india" or "state-27".
    slug: { type: String, unique: true, sparse: true },
    lastMessageAt: Date,
    lastMessagePreview: String,
    lastSenderBusinessId: Schema.Types.ObjectId,
    lastFromSupport: { type: Boolean, default: false },
    // When a support agent last read this support thread (agent-side unread).
    supportReadAt: Date,
    // Per-business read marker (direct chats) for unread badges and "Seen".
    reads: {
      type: [{ _id: false, businessId: Schema.Types.ObjectId, at: Date }],
      default: [],
    },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export type ConversationDoc = InferSchemaType<typeof conversationSchema> & { _id: mongoose.Types.ObjectId };

export const Conversation: Model<ConversationDoc> =
  (mongoose.models.Conversation as Model<ConversationDoc>) ??
  mongoose.model<ConversationDoc>("Conversation", conversationSchema);

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    // Unset for messages written by support agents (fromSupport = true).
    senderBusinessId: { type: Schema.Types.ObjectId, ref: "Business" },
    fromSupport: { type: Boolean, default: false },
    senderUserId: { type: String, required: true },
    // Snapshots so rendering needs no joins.
    senderBusinessName: { type: String, required: true },
    senderUserName: { type: String, required: true },
    senderCity: String,
    text: { type: String, maxlength: 2000, default: "" },
    image: { publicId: String, width: Number, height: Number },
    reports: {
      type: [{ _id: false, businessId: Schema.Types.ObjectId, userId: String, reason: String, at: Date }],
      default: [],
    },
    // Set by an admin after a report; hidden messages show a placeholder.
    hidden: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export type MessageDoc = InferSchemaType<typeof messageSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };

export const Message: Model<MessageDoc> =
  (mongoose.models.Message as Model<MessageDoc>) ?? mongoose.model<MessageDoc>("Message", messageSchema);
