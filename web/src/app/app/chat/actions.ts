"use server";

import { redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import {
  getConversation,
  getMessages,
  getMessagesSince,
  getOrCreateDirect,
  markRead,
  sendMessage,
  type ChatMessage,
} from "@/lib/chat/service";
import { cloudinaryConfigured, signChatUpload, verifyChatImage } from "@/lib/cloudinary";
import { connectDB } from "@/lib/db/mongo";
import { Message } from "@/lib/models/chat";
import { requireBusiness } from "@/lib/session";

const RATE_LIMIT_PER_MINUTE = 30;

async function requireChat() {
  return requireBusiness({ permission: "chat.use" });
}

export async function startDirectChat(otherBusinessId: string) {
  const { business } = await requireChat();
  const conv = await getOrCreateDirect(business, otherBusinessId);
  if (!conv) redirect("/app/chat");
  redirect(`/app/chat/${conv._id}`);
}

const sendSchema = z.object({
  text: z.string().trim().max(2000).default(""),
  imagePublicId: z.string().max(300).optional(),
});

export async function sendChatMessage(
  conversationId: string,
  input: z.input<typeof sendSchema>,
): Promise<{ message?: ChatMessage; error?: string }> {
  const { business, session } = await requireChat();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success || (!parsed.data.text && !parsed.data.imagePublicId)) return { error: "invalid" };
  const conv = await getConversation(conversationId, business);
  if (!conv) return { error: "not_found" };

  await connectDB();
  const recent = await Message.countDocuments({
    senderUserId: session.user.id,
    createdAt: { $gt: new Date(Date.now() - 60_000) },
  });
  if (recent >= RATE_LIMIT_PER_MINUTE) return { error: "rate_limited" };

  let image;
  if (parsed.data.imagePublicId) {
    image = await verifyChatImage(conversationId, parsed.data.imagePublicId);
    if (!image) return { error: "upload_failed" };
  }
  const message = await sendMessage({
    conv,
    business,
    user: { id: session.user.id, name: session.user.name },
    text: parsed.data.text,
    image: image ?? undefined,
  });
  return { message };
}

export async function getChatUploadSignature(conversationId: string) {
  const { business } = await requireChat();
  if (!cloudinaryConfigured()) throw new Error("not_configured");
  const conv = await getConversation(conversationId, business);
  if (!conv) throw new Error("not_found");
  return signChatUpload(conversationId);
}

/** Polling fallback while the realtime socket is disconnected. */
export async function fetchNewMessages(conversationId: string, afterIso: string): Promise<ChatMessage[]> {
  const { business } = await requireChat();
  const conv = await getConversation(conversationId, business);
  const after = new Date(afterIso);
  if (!conv || Number.isNaN(after.getTime())) return [];
  return getMessagesSince(conv._id, after);
}

export async function fetchOlderMessages(conversationId: string, beforeIso: string) {
  const { business } = await requireChat();
  const conv = await getConversation(conversationId, business);
  const before = new Date(beforeIso);
  if (!conv || Number.isNaN(before.getTime())) return { messages: [] as ChatMessage[], hasMore: false };
  return getMessages(conv._id, before);
}

export async function markConversationRead(conversationId: string) {
  const { business } = await requireChat();
  const conv = await getConversation(conversationId, business);
  if (conv) await markRead(conv, business);
}

export async function reportMessage(messageId: string, reason: string) {
  const { business, session } = await requireChat();
  if (!isValidObjectId(messageId)) return { error: "invalid" };
  await connectDB();
  const msg = await Message.findById(messageId, { conversationId: 1, senderBusinessId: 1 }).lean();
  if (!msg || String(msg.senderBusinessId) === String(business._id)) return { error: "invalid" };
  if (!(await getConversation(String(msg.conversationId), business))) return { error: "not_found" };
  await Message.updateOne(
    { _id: messageId, "reports.businessId": { $ne: business._id } },
    { $push: { reports: { businessId: business._id, userId: session.user.id, reason: reason.slice(0, 200), at: new Date() } } },
  );
  return { ok: true };
}
