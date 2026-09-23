"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { requireShop } from "@/lib/retail/guard";
import { markContacted } from "@/lib/retail/refills";

/** Ticks a customer off the counter's call-list for this refill cycle. */
export async function markRefillContacted(customerId: string, productId: string, dueOn: string) {
  const { business, session } = await requireShop("retail.sell");
  if (!isValidObjectId(customerId) || !isValidObjectId(productId) || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) {
    return { error: "invalid" };
  }
  await markContacted(business._id, { customerId, productId, dueOn }, session.user.id);
  revalidatePath("/app/shop/refills");
  return { ok: true };
}
