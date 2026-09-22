"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrCreateSupport } from "@/lib/chat/service";
import { addReply, createTicket, getTicketForBusiness, setTicketStatusByCustomer } from "@/lib/support/service";
import { fieldErrors } from "@/lib/validation/business";
import { newTicketSchema, replySchema } from "@/lib/validation/support";
import { requireBusiness } from "@/lib/session";

export type SupportFormState = { ok?: boolean; errors?: Record<string, string>; ticketId?: string };

/** Businesses still in verification may raise tickets too (KYC help is the #1 need). */
async function requireSupportUser() {
  return requireBusiness({ allowUnapproved: true });
}

export async function createSupportTicket(_: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const { business, session } = await requireSupportUser();
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = newTicketSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const ticket = await createTicket({ business, user: { id: session.user.id, name: session.user.name }, input: parsed.data });
  revalidatePath("/app/support");
  if (business.kyc?.status === "approved") redirect(`/app/support/${ticket._id}`);
  return { ok: true, ticketId: String(ticket._id) };
}

export async function replyToTicket(ticketId: string, _: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const { business, session } = await requireSupportUser();
  const parsed = replySchema.safeParse({ text: formData.get("text") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const ticket = await getTicketForBusiness(ticketId, business);
  if (!ticket) return { errors: { text: "not_found" } };
  await addReply({ ticket, author: { id: session.user.id, name: session.user.name }, fromSupport: false, text: parsed.data.text });
  revalidatePath(`/app/support/${ticketId}`);
  return { ok: true };
}

export async function setMyTicketStatus(ticketId: string, status: "closed" | "open") {
  const { business } = await requireSupportUser();
  const ticket = await getTicketForBusiness(ticketId, business);
  if (!ticket || (status !== "closed" && status !== "open")) return;
  await setTicketStatusByCustomer(ticket, status);
  revalidatePath(`/app/support/${ticketId}`);
  revalidatePath("/app/support");
}

export async function openSupportChat() {
  const { business } = await requireBusiness({ permission: "chat.use" });
  const conv = await getOrCreateSupport(business);
  redirect(`/app/chat/${conv!._id}`);
}
