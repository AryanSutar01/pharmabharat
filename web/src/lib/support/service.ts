import "server-only";
import mongoose from "mongoose";
import { connectDB, mongoDb } from "@/lib/db/mongo";
import { sendMail } from "@/lib/mail";
import { newTicketStaffEmail, ticketUpdateEmail } from "@/lib/mail/templates";
import type { BusinessDoc } from "@/lib/models/business";
import { nextSequence } from "@/lib/models/order";
import { Ticket, type TicketDoc } from "@/lib/models/ticket";
import { notify } from "@/lib/notifications";
import { getUsersByIds } from "@/lib/users";
import type { NewTicketInput } from "@/lib/validation/support";
import { ACTIVE_STATUSES, type TicketPriority, type TicketStatus } from "./constants";

/** Emails of everyone who works the support desk. */
async function staffEmails() {
  const rows = await mongoDb()
    .collection("user")
    .find({ platformRole: { $in: ["support", "admin"] }, banned: { $ne: true } }, { projection: { email: 1 } })
    .toArray();
  return rows.map((r) => r.email as string).filter(Boolean);
}

async function businessRecipients(t: TicketDoc) {
  const creator = (await getUsersByIds([t.createdBy])).get(t.createdBy);
  return creator?.email ? [creator.email] : [];
}

export async function createTicket(opts: {
  business: BusinessDoc;
  user: { id: string; name: string };
  input: NewTicketInput;
}) {
  await connectDB();
  const { business, user, input } = opts;
  const seq = await nextSequence("ticket");
  const isCallback = input.kind === "callback";
  const ticket = await Ticket.create({
    number: `TKT-${String(seq).padStart(6, "0")}`,
    kind: input.kind,
    businessId: business._id,
    businessName: business.tradeName || business.legalName,
    createdBy: user.id,
    createdByName: user.name,
    category: input.category,
    priority: isCallback ? "normal" : input.priority,
    subject: isCallback ? `Call-back request (${input.slot})` : input.subject,
    orderNo: isCallback ? undefined : input.orderNo,
    callback: isCallback ? { phone: input.phone, slot: input.slot, language: input.language } : undefined,
    replies: input.message ? [{ authorUserId: user.id, authorName: user.name, text: input.message }] : [],
  });
  const doc = ticket.toObject() as TicketDoc;
  const mail = newTicketStaffEmail(doc);
  for (const to of await staffEmails()) await sendMail({ to, ...mail });
  return doc;
}

/**
 * Adds a reply. Side effects on status:
 * - customer replies re-open a waiting/resolved ticket;
 * - the first agent reply moves "open" to "in progress".
 */
export async function addReply(opts: {
  ticket: TicketDoc;
  author: { id: string; name: string };
  fromSupport: boolean;
  text: string;
}) {
  await connectDB();
  const { ticket, fromSupport } = opts;
  const status = ticket.status as TicketStatus;
  let next: TicketStatus = status;
  if (!fromSupport && (status === "waiting_on_customer" || status === "resolved")) next = "open";
  if (fromSupport && status === "open") next = "in_progress";

  const updated = await Ticket.findByIdAndUpdate(
    ticket._id,
    {
      $push: { replies: { authorUserId: opts.author.id, authorName: opts.author.name, fromSupport, text: opts.text } },
      $set: {
        status: next,
        lastActivityAt: new Date(),
        ...(fromSupport && !ticket.assigneeUserId ? { assigneeUserId: opts.author.id, assigneeName: opts.author.name } : {}),
      },
    },
    { returnDocument: "after" },
  ).lean();
  if (!updated) return null;

  if (fromSupport) {
    await notifyBusiness(updated, "reply", opts.text);
  } else {
    const mail = ticketUpdateEmail({ ticket: updated, audience: "staff", event: "reply", text: opts.text });
    for (const to of await staffEmails()) await sendMail({ to, ...mail });
  }
  return updated;
}

async function notifyBusiness(t: TicketDoc, event: "reply" | "status", text?: string) {
  await notify({
    businessId: t.businessId,
    userIds: [t.createdBy],
    kind: "support_update",
    params: { number: t.number, status: t.status },
    link: `/app/support/${t._id}`,
  });
  const mail = ticketUpdateEmail({ ticket: t, audience: "business", event, text });
  for (const to of await businessRecipients(t)) await sendMail({ to, ...mail });
}

export async function updateTicketByDesk(
  id: string,
  agent: { id: string; name: string },
  patch: { status?: TicketStatus; priority?: TicketPriority; assignToMe?: boolean },
) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const before = await Ticket.findById(id).lean();
  if (!before) return null;
  const set: Record<string, unknown> = { lastActivityAt: new Date() };
  if (patch.status) set.status = patch.status;
  if (patch.priority) set.priority = patch.priority;
  if (patch.assignToMe) Object.assign(set, { assigneeUserId: agent.id, assigneeName: agent.name });
  const updated = await Ticket.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after" }).lean();
  if (updated && patch.status && patch.status !== before.status) await notifyBusiness(updated, "status");
  return updated;
}

/** Customer closes or re-opens their own ticket. */
export async function setTicketStatusByCustomer(ticket: TicketDoc, status: "closed" | "open") {
  await connectDB();
  const allowedFrom: TicketStatus[] = status === "closed" ? [...ACTIVE_STATUSES, "resolved"] : ["resolved", "closed"];
  return Ticket.findOneAndUpdate(
    { _id: ticket._id, status: { $in: allowedFrom } },
    { $set: { status, lastActivityAt: new Date() } },
    { returnDocument: "after" },
  ).lean();
}

export async function getTicketForBusiness(id: string, business: BusinessDoc) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  return Ticket.findOne({ _id: id, businessId: business._id }).lean();
}
