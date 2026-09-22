"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import {
  getMessages,
  getMessagesSince,
  getSupportConversation,
  markSupportRead,
  sendMessage,
  type ChatMessage,
} from "@/lib/chat/service";
import { cloudinaryConfigured, signChatUpload, verifyChatImage } from "@/lib/cloudinary";
import { connectDB } from "@/lib/db/mongo";
import { Ticket } from "@/lib/models/ticket";
import { addReply, updateTicketByDesk } from "@/lib/support/service";
import { fieldErrors } from "@/lib/validation/business";
import { deskUpdateSchema, replySchema } from "@/lib/validation/support";
import { requirePlatformRole } from "@/lib/session";
import type { SupportFormState } from "@/app/app/support/actions";

const requireAgent = () => requirePlatformRole("support", "admin");

// ---------------------------------------------------------------- tickets

export async function deskReply(ticketId: string, _: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const session = await requireAgent();
  const parsed = replySchema.safeParse({ text: formData.get("text") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (!isValidObjectId(ticketId)) return { errors: { text: "not_found" } };
  await connectDB();
  const ticket = await Ticket.findById(ticketId).lean();
  if (!ticket) return { errors: { text: "not_found" } };
  await addReply({ ticket, author: { id: session.user.id, name: session.user.name }, fromSupport: true, text: parsed.data.text });
  revalidatePath(`/support-desk/tickets/${ticketId}`);
  return { ok: true };
}

export async function deskUpdate(ticketId: string, formData: FormData) {
  const session = await requireAgent();
  const parsed = deskUpdateSchema.safeParse({
    status: formData.get("status") || undefined,
    priority: formData.get("priority") || undefined,
  });
  if (!parsed.success) return;
  await updateTicketByDesk(ticketId, { id: session.user.id, name: session.user.name }, {
    ...parsed.data,
    assignToMe: formData.get("assignToMe") === "1",
  });
  revalidatePath(`/support-desk/tickets/${ticketId}`);
  revalidatePath("/support-desk");
}

// ---------------------------------------------------------------- live chat (same shape as the business chat actions)

async function agentConversation(id: string) {
  await requireAgent();
  return getSupportConversation(id);
}

export async function agentSend(conversationId: string, input: { text: string; imagePublicId?: string }) {
  const session = await requireAgent();
  const conv = await getSupportConversation(conversationId);
  const text = (input.text ?? "").trim().slice(0, 2000);
  if (!conv || (!text && !input.imagePublicId)) return { error: "invalid" };
  let image;
  if (input.imagePublicId) {
    image = await verifyChatImage(conversationId, input.imagePublicId);
    if (!image) return { error: "upload_failed" };
  }
  const message = await sendMessage({
    conv,
    business: null,
    user: { id: session.user.id, name: session.user.name },
    text,
    image: image ?? undefined,
  });
  revalidatePath("/support-desk/chat", "layout");
  return { message };
}

export async function agentFetchNew(conversationId: string, afterIso: string): Promise<ChatMessage[]> {
  const conv = await agentConversation(conversationId);
  const after = new Date(afterIso);
  return conv && !Number.isNaN(after.getTime()) ? getMessagesSince(conv._id, after) : [];
}

export async function agentFetchOlder(conversationId: string, beforeIso: string) {
  const conv = await agentConversation(conversationId);
  const before = new Date(beforeIso);
  if (!conv || Number.isNaN(before.getTime())) return { messages: [] as ChatMessage[], hasMore: false };
  return getMessages(conv._id, before);
}

export async function agentMarkRead(conversationId: string) {
  const conv = await agentConversation(conversationId);
  if (conv) await markSupportRead(conv);
}

export async function agentUploadSignature(conversationId: string) {
  const conv = await agentConversation(conversationId);
  if (!conv || !cloudinaryConfigured()) throw new Error("not_found");
  return signChatUpload(conversationId);
}
