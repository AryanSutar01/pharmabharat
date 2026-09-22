import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canAccess,
  getOrCreateSupport,
  listSupportConversations,
  markRead,
  markSupportRead,
  sendMessage,
  unreadDirectCount,
} from "@/lib/chat/service";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Conversation } from "@/lib/models/chat";
import { Notification } from "@/lib/models/notification";
import { addReply, createTicket, setTicketStatusByCustomer, updateTicketByDesk } from "@/lib/support/service";

const USER = { id: "cust-1", name: "Ravi" };
const AGENT = { id: "agent-1", name: "Priya (Support)" };

async function business(name: string) {
  const b = await Business.create({
    type: "retailer",
    legalName: name,
    ownerUserId: USER.id,
    address: { line1: "x", city: "Nashik", stateCode: "27", pincode: "422001" },
    kyc: { status: "approved" },
  });
  return b.toObject() as BusinessDoc;
}

describe("support (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let other: BusinessDoc;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    shop = await business("Ravi Medical");
    other = await business("Other Store");
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("numbers tickets and records the first message", async () => {
    const a = await createTicket({
      business: shop,
      user: USER,
      input: { kind: "ticket", category: "invoice", priority: "high", subject: "Invoice shows wrong GST", message: "IGST charged on a local order" },
    });
    const b = await createTicket({
      business: shop,
      user: USER,
      input: { kind: "callback", category: "kyc", phone: "9876543210", slot: "evening", language: "mr", message: "" },
    });
    expect(a.number).toMatch(/^TKT-\d{6}$/);
    expect(Number(b.number.slice(4))).toBe(Number(a.number.slice(4)) + 1);
    expect(a.replies).toHaveLength(1);
    expect(b.subject).toBe("Call-back request (evening)");
    expect(b.callback).toMatchObject({ phone: "9876543210", slot: "evening", language: "mr" });
  });

  it("moves status with replies and notifies the customer in-app", async () => {
    let t = await createTicket({
      business: shop,
      user: USER,
      input: { kind: "ticket", category: "order", priority: "normal", subject: "Order not received", message: "Placed 3 days ago" },
    });
    t = (await addReply({ ticket: t, author: AGENT, fromSupport: true, text: "Checking with the distributor." }))!;
    expect(t.status).toBe("in_progress");
    expect(t.assigneeName).toBe(AGENT.name); // first agent reply self-assigns

    t = (await updateTicketByDesk(String(t._id), AGENT, { status: "waiting_on_customer" }))!;
    expect(t.status).toBe("waiting_on_customer");
    t = (await addReply({ ticket: t, author: USER, fromSupport: false, text: "It arrived today, thanks!" }))!;
    expect(t.status).toBe("open"); // customer reply re-opens

    t = (await setTicketStatusByCustomer(t, "closed"))!;
    expect(t.status).toBe("closed");
    expect(await Notification.countDocuments({ userId: USER.id, kind: "support_update" })).toBe(2); // reply + status change
  });

  it("support chat: one thread per business, visible only to that business, unread on both sides", async () => {
    const c1 = await getOrCreateSupport(shop);
    const c2 = await getOrCreateSupport(shop);
    expect(String(c1!._id)).toBe(String(c2!._id));
    expect(canAccess(c1!, shop)).toBe(true);
    expect(canAccess(c1!, other)).toBe(false);

    // Business writes → unread for agents.
    await sendMessage({ conv: c1!, business: shop, user: USER, text: "Hi, need help with KYC" });
    let desk = await listSupportConversations();
    expect(desk.find((c) => c.id === String(c1!._id))?.unread).toBe(true);
    await markSupportRead((await Conversation.findById(c1!._id).lean())!);
    desk = await listSupportConversations();
    expect(desk.find((c) => c.id === String(c1!._id))?.unread).toBe(false);

    // Agent replies → unread for the business, cleared on read.
    await sendMessage({ conv: c1!, business: null, user: AGENT, text: "Sure — which document is failing?" });
    expect(await unreadDirectCount(shop)).toBe(1);
    await markRead((await Conversation.findById(c1!._id).lean())!, shop);
    expect(await unreadDirectCount(shop)).toBe(0);
  });
});
