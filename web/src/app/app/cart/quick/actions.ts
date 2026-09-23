"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongo";
import { Cart } from "@/lib/models/cart";
import { Listing } from "@/lib/models/listing";
import { requireBuyer } from "@/lib/orders/cart";
import { parsePurchaseList } from "@/lib/orders/quick-list";
import { matchPurchaseList, type MatchedLine } from "@/lib/orders/reorder";

const MAX_CART_LINES = 100;

export type QuickState = {
  error?: string;
  text?: string;
  lines?: MatchedLine[];
  added?: number;
  skipped?: number;
};

const addSchema = z.array(z.object({ listingId: z.string().length(24), qty: z.number().int().min(1).max(100_000) })).max(200);

export async function previewList(_: QuickState, formData: FormData): Promise<QuickState> {
  const { business } = await requireBuyer();
  const text = String(formData.get("text") ?? "");
  const parsed = parsePurchaseList(text);
  if (!parsed.length) return { error: "csv_missing", text };
  return { text, lines: await matchPurchaseList(parsed, business._id) };
}

/** Adds the lines the buyer confirmed. Anything unavailable is reported back. */
export async function addLinesToCart(_: QuickState, formData: FormData): Promise<QuickState> {
  const { business, session } = await requireBuyer();
  let wanted: { listingId: string; qty: number }[];
  try {
    wanted = addSchema.parse(JSON.parse(String(formData.get("lines") ?? "[]")));
  } catch {
    return { error: "invalid" };
  }
  if (!wanted.length) return { error: "cart_empty" };

  await connectDB();
  const listings = await Listing.find(
    { _id: { $in: wanted.map((w) => w.listingId) }, status: "active", sellerId: { $ne: business._id } },
    { stock: 1, minOrderQty: 1 },
  ).lean();
  const byId = new Map(listings.map((l) => [String(l._id), l]));

  const filter = { businessId: business._id, userId: session.user.id };
  const cart = await Cart.findOne(filter, { items: 1 }).lean();
  const items: { listingId: mongoose.Types.ObjectId; qty: number }[] = (cart?.items ?? []).map((i) => ({
    listingId: i.listingId,
    qty: i.qty,
  }));
  let added = 0;

  for (const { listingId, qty } of wanted) {
    const listing = byId.get(listingId);
    if (!listing) continue;
    const want = Math.min(Math.max(qty, listing.minOrderQty ?? 1), listing.stock);
    if (want < 1) continue;
    const existing = items.find((i) => String(i.listingId) === listingId);
    if (existing) existing.qty = Math.min(existing.qty + want, listing.stock);
    else if (items.length < MAX_CART_LINES) items.push({ listingId: listing._id, qty: want });
    else break;
    added++;
  }
  if (!added) return { error: "out_of_stock" };

  await Cart.updateOne(filter, { $set: { items } }, { upsert: true });
  revalidatePath("/app", "layout");
  return { added, skipped: wanted.length - added };
}
