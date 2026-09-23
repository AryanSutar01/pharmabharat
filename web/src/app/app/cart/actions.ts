"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { checkPriceAlertsSafely } from "@/lib/alerts/price";
import { connectDB } from "@/lib/db/mongo";
import { Cart } from "@/lib/models/cart";
import { Listing } from "@/lib/models/listing";
import { requireBuyer } from "@/lib/orders/cart";
import { applySavings } from "@/lib/orders/optimise-service";
import { notifyOrdersPlaced } from "@/lib/orders/notify";
import { CheckoutError, placeOrders } from "@/lib/orders/service";
import { PAYMENT_MODES } from "@/lib/orders/status";

const MAX_CART_LINES = 100;
const MAX_QTY = 100_000;

export type CartActionResult = { ok?: boolean; error?: string };

export async function addToCart(listingId: string, qty: number): Promise<CartActionResult> {
  const { business, session } = await requireBuyer();
  if (!isValidObjectId(listingId) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { error: "invalid" };
  await connectDB();
  const listing = await Listing.findOne({ _id: listingId, status: "active" }, { sellerId: 1, stock: 1 }).lean();
  if (!listing) return { error: "not_found" };
  if (String(listing.sellerId) === String(business._id)) return { error: "own_listing" };

  const filter = { businessId: business._id, userId: session.user.id };
  // Increase qty if already in the cart, otherwise append (capped).
  const bumped = await Cart.updateOne({ ...filter, "items.listingId": listing._id }, { $inc: { "items.$.qty": qty } });
  if (!bumped.matchedCount) {
    const cart = await Cart.findOne(filter, { items: 1 }).lean();
    if ((cart?.items.length ?? 0) >= MAX_CART_LINES) return { error: "cart_full" };
    await Cart.updateOne(filter, { $push: { items: { listingId: listing._id, qty } } }, { upsert: true });
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function setCartQty(listingId: string, qty: number): Promise<CartActionResult> {
  const { business, session } = await requireBuyer();
  if (!isValidObjectId(listingId) || !Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) return { error: "invalid" };
  await connectDB();
  const filter = { businessId: business._id, userId: session.user.id };
  if (qty === 0) await Cart.updateOne(filter, { $pull: { items: { listingId } } });
  else await Cart.updateOne({ ...filter, "items.listingId": listingId }, { $set: { "items.$.qty": qty } });
  revalidatePath("/app", "layout");
  return { ok: true };
}

const checkoutSchema = z.object({
  paymentMode: z.enum(PAYMENT_MODES),
  notes: z.string().trim().max(500).optional(),
});

export async function checkout(_: CartActionResult, formData: FormData): Promise<CartActionResult> {
  const { business, session } = await requireBuyer();
  const parsed = checkoutSchema.safeParse({
    paymentMode: formData.get("paymentMode"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  let groupId: string;
  try {
    const result = await placeOrders({ buyer: business, userId: session.user.id, ...parsed.data });
    groupId = result.groupId;
    // Emails go out after the response so checkout stays fast.
    after(async () => {
      await notifyOrdersPlaced(result.orders);
      // Buying out the cheapest batch can raise the best price for others.
      await checkPriceAlertsSafely(result.orders.flatMap((o) => o.items.map((i) => i.productId)));
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      revalidatePath("/app/cart");
      return { error: err.code };
    }
    throw err;
  }
  revalidatePath("/app", "layout");
  redirect(`/app/orders?placed=${groupId}`);
}

/** Swaps every cart line to the cheapest verified seller that can fulfil it. */
export async function applyCheapest(): Promise<CartActionResult & { applied?: number; saved?: number }> {
  const { business, session } = await requireBuyer();
  const { applied, saved } = await applySavings(business._id, session.user.id);
  if (!applied) return { error: "not_found" };
  revalidatePath("/app", "layout");
  return { ok: true, applied, saved };
}
