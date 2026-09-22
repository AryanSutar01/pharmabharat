import "server-only";
import mongoose from "mongoose";
import { chatImageUrl, cloudinaryConfigured } from "@/lib/cloudinary";
import { connectDB } from "@/lib/db/mongo";
import { stateName } from "@/lib/india";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Conversation, Message, type ConversationDoc, type MessageDoc } from "@/lib/models/chat";
import { publish, rooms } from "@/lib/realtime";

export const PAGE_SIZE = 50;

/** What the browser receives for one message (also the realtime payload). */
export type ChatMessage = {
  id: string;
  conversationId: string;
  senderBusinessId: string;
  senderBusinessName: string;
  senderUserName: string;
  senderCity: string;
  text: string;
  imageUrl: string | null;
  hidden: boolean;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  type: "direct" | "community";
  /** Community rooms only: "india" or "state-27" (the UI translates "india"). */
  slug?: string;
  title: string;
  subtitle: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unread: boolean;
};

// ---------------------------------------------------------------- community rooms

export function communitySlugs(business: BusinessDoc) {
  return ["india", ...(business.address?.stateCode ? [`state-${business.address.stateCode}`] : [])];
}

async function ensureCommunity(slug: string) {
  return Conversation.findOneAndUpdate(
    { slug },
    { $setOnInsert: { type: "community", slug } },
    { upsert: true, returnDocument: "after" },
  ).lean();
}

export function communityTitle(slug: string) {
  return slug === "india" ? "All India" : stateName(slug.replace("state-", ""));
}

// ---------------------------------------------------------------- access

export function canAccess(conv: Pick<ConversationDoc, "type" | "participants" | "slug">, business: BusinessDoc) {
  if (conv.type === "direct") return conv.participants.some((p) => String(p) === String(business._id));
  return communitySlugs(business).includes(conv.slug ?? "");
}

/** Rooms that should receive live events for a conversation. */
function roomsFor(conv: Pick<ConversationDoc, "type" | "participants" | "slug">) {
  return conv.type === "direct" ? conv.participants.map(rooms.business) : [rooms.community(conv.slug!)];
}

/** Rooms a business's members may subscribe to (baked into their realtime token). */
export function allowedRooms(business: BusinessDoc) {
  return [rooms.business(business._id), ...communitySlugs(business).map(rooms.community)];
}

// ---------------------------------------------------------------- conversations

export async function getOrCreateDirect(me: BusinessDoc, otherId: string) {
  if (!mongoose.isValidObjectId(otherId) || otherId === String(me._id)) return null;
  await connectDB();
  const other = await Business.exists({ _id: otherId, "kyc.status": "approved" });
  if (!other) return null;
  const ids = [String(me._id), otherId].sort();
  return Conversation.findOneAndUpdate(
    { pairKey: ids.join(":") },
    { $setOnInsert: { type: "direct", pairKey: ids.join(":"), participants: ids.map((i) => new mongoose.Types.ObjectId(i)) } },
    { upsert: true, returnDocument: "after" },
  ).lean();
}

export async function getConversation(id: string, business: BusinessDoc) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const conv = await Conversation.findById(id).lean();
  return conv && canAccess(conv, business) ? conv : null;
}

function isUnread(conv: ConversationDoc, businessId: mongoose.Types.ObjectId) {
  if (conv.type !== "direct" || !conv.lastMessageAt) return false;
  if (String(conv.lastSenderBusinessId) === String(businessId)) return false;
  const read = conv.reads.find((r) => String(r.businessId) === String(businessId))?.at;
  return !read || new Date(read) < new Date(conv.lastMessageAt);
}

export async function listConversations(business: BusinessDoc): Promise<ConversationSummary[]> {
  await connectDB();
  const communities = await Promise.all(communitySlugs(business).map(ensureCommunity));
  const direct = await Conversation.find({ type: "direct", participants: business._id, lastMessageAt: { $ne: null } })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .lean();
  const otherIds = direct.map((c) => c.participants.find((p) => String(p) !== String(business._id)));
  const others = await Business.find({ _id: { $in: otherIds.filter((x): x is mongoose.Types.ObjectId => Boolean(x)) } }, { legalName: 1, tradeName: 1, type: 1, address: 1 }).lean();
  const otherById = new Map(others.map((o) => [String(o._id), o]));

  const toSummary = (c: ConversationDoc, title: string, subtitle: string): ConversationSummary => ({
    id: String(c._id),
    type: c.type as "direct" | "community",
    slug: c.slug ?? undefined,
    title,
    subtitle,
    lastMessagePreview: c.lastMessagePreview ?? "",
    lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : null,
    unread: isUnread(c, business._id),
  });

  return [
    ...communities.filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => toSummary(c, communityTitle(c.slug!), "community")),
    ...direct.map((c, i) => {
      const o = otherById.get(String(otherIds[i]));
      return toSummary(c, o ? o.tradeName || o.legalName : "—", o ? `${o.address?.city ?? ""}` : "");
    }),
  ];
}

export async function unreadDirectCount(business: BusinessDoc) {
  await connectDB();
  const convs = await Conversation.find(
    { type: "direct", participants: business._id, lastMessageAt: { $ne: null }, lastSenderBusinessId: { $ne: business._id } },
    { reads: 1, lastMessageAt: 1, lastSenderBusinessId: 1, type: 1 },
  )
    .limit(200)
    .lean();
  return convs.filter((c) => isUnread(c as ConversationDoc, business._id)).length;
}

export async function markRead(conv: ConversationDoc, business: BusinessDoc) {
  if (conv.type !== "direct") return;
  const now = new Date();
  const res = await Conversation.updateOne(
    { _id: conv._id, "reads.businessId": business._id },
    { $set: { "reads.$.at": now } },
  );
  if (!res.matchedCount) await Conversation.updateOne({ _id: conv._id }, { $push: { reads: { businessId: business._id, at: now } } });
  // Lets the other side show "Seen".
  await publish(roomsFor(conv), "read", { conversationId: String(conv._id), businessId: String(business._id), at: now.toISOString() });
}

/** When the other business last read this direct chat (for "Seen"). */
export function otherReadAt(conv: ConversationDoc, business: BusinessDoc) {
  const r = conv.reads.find((x) => String(x.businessId) !== String(business._id))?.at;
  return r ? new Date(r).toISOString() : null;
}

// ---------------------------------------------------------------- messages

export function toChatMessage(m: MessageDoc): ChatMessage {
  const imageUrl = !m.hidden && m.image?.publicId && cloudinaryConfigured() ? chatImageUrl(m.image.publicId) : null;
  return {
    id: String(m._id),
    conversationId: String(m.conversationId),
    senderBusinessId: String(m.senderBusinessId),
    senderBusinessName: m.senderBusinessName,
    senderUserName: m.senderUserName,
    senderCity: m.senderCity ?? "",
    text: m.hidden ? "" : (m.text ?? ""),
    imageUrl,
    hidden: Boolean(m.hidden),
    createdAt: new Date(m.createdAt).toISOString(),
  };
}

/** Newest page (or the page before `before`), returned oldest → newest. */
export async function getMessages(conversationId: mongoose.Types.ObjectId, before?: Date) {
  await connectDB();
  const docs = await Message.find({ conversationId, ...(before ? { createdAt: { $lt: before } } : {}) })
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE)
    .lean();
  return { messages: docs.reverse().map(toChatMessage), hasMore: docs.length === PAGE_SIZE };
}

export async function getMessagesSince(conversationId: mongoose.Types.ObjectId, after: Date) {
  await connectDB();
  const docs = await Message.find({ conversationId, createdAt: { $gt: after } }).sort({ createdAt: 1 }).limit(PAGE_SIZE).lean();
  return docs.map(toChatMessage);
}

export async function sendMessage(opts: {
  conv: ConversationDoc;
  business: BusinessDoc;
  user: { id: string; name: string };
  text: string;
  image?: { publicId: string; width: number; height: number };
}) {
  await connectDB();
  const { conv, business } = opts;
  const doc = await Message.create({
    conversationId: conv._id,
    senderBusinessId: business._id,
    senderUserId: opts.user.id,
    senderBusinessName: business.tradeName || business.legalName,
    senderUserName: opts.user.name,
    senderCity: business.address?.city,
    text: opts.text,
    image: opts.image,
  });
  const preview = opts.text ? opts.text.slice(0, 80) : "📷";
  await Conversation.updateOne(
    { _id: conv._id },
    { $set: { lastMessageAt: doc.createdAt, lastMessagePreview: preview, lastSenderBusinessId: business._id } },
  );
  const message = toChatMessage(doc.toObject() as MessageDoc);
  await publish(roomsFor(conv), "message", message);
  return message;
}
