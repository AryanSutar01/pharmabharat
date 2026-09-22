import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  allowedRooms,
  canAccess,
  getMessages,
  getOrCreateDirect,
  listConversations,
  markRead,
  sendMessage,
  unreadDirectCount,
} from "@/lib/chat/service";
import { connectDB } from "@/lib/db/mongo";
import type { StateCode } from "@/lib/india";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Conversation } from "@/lib/models/chat";

async function business(name: string, stateCode: StateCode, status: "approved" | "pending" = "approved") {
  const b = await Business.create({
    type: "retailer",
    legalName: name,
    ownerUserId: "u",
    address: { line1: "x", city: "City", stateCode, pincode: "411001" },
    kyc: { status },
  });
  return b.toObject() as BusinessDoc;
}

describe("chat (integration, database: pharmabharat_test)", () => {
  let a: BusinessDoc, b: BusinessDoc, c: BusinessDoc, pending: BusinessDoc;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    a = await business("A Pharma", "27");
    b = await business("B Medical", "27");
    c = await business("C Gujarat", "24");
    pending = await business("Pending Co", "27", "pending");
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("creates exactly one direct thread per pair, in either direction", async () => {
    const ab = await getOrCreateDirect(a, String(b._id));
    const ba = await getOrCreateDirect(b, String(a._id));
    expect(String(ab!._id)).toBe(String(ba!._id));
    expect(await Conversation.countDocuments({ type: "direct" })).toBe(1);
  });

  it("refuses chats with yourself or unverified businesses", async () => {
    expect(await getOrCreateDirect(a, String(a._id))).toBeNull();
    expect(await getOrCreateDirect(a, String(pending._id))).toBeNull();
    expect(await getOrCreateDirect(a, "not-an-id")).toBeNull();
  });

  it("limits access to participants and to the business's own state room", async () => {
    const ab = (await getOrCreateDirect(a, String(b._id)))!;
    expect(canAccess(ab, a)).toBe(true);
    expect(canAccess(ab, c)).toBe(false);

    const convs = await listConversations(a);
    const slugs = convs.filter((x) => x.type === "community").map((x) => x.slug);
    expect(slugs).toEqual(["india", "state-27"]);
    const mh = await Conversation.findOne({ slug: "state-27" }).lean();
    expect(canAccess(mh!, b)).toBe(true);
    expect(canAccess(mh!, c)).toBe(false); // Gujarat business can't read the Maharashtra room

    expect(allowedRooms(c)).toEqual([`biz:${c._id}`, "community:india", "community:state-24"]);
  });

  it("tracks unread messages per business and clears them on read", async () => {
    const ab = (await getOrCreateDirect(a, String(b._id)))!;
    await sendMessage({ conv: ab, business: a, user: { id: "ua", name: "Asha" }, text: "Hello, is Dolo 650 in stock?" });

    expect(await unreadDirectCount(b)).toBe(1);
    expect(await unreadDirectCount(a)).toBe(0); // own message is never unread

    const conv = (await Conversation.findById(ab._id).lean())!;
    expect(conv.lastMessagePreview).toBe("Hello, is Dolo 650 in stock?");
    await markRead(conv, b);
    expect(await unreadDirectCount(b)).toBe(0);

    const { messages } = await getMessages(ab._id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ senderBusinessName: "A Pharma", senderUserName: "Asha", imageUrl: null, hidden: false });
  });
});
