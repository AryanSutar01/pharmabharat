"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { setReorderLevel } from "@/lib/retail/alerts";
import { requireShop } from "@/lib/retail/guard";

/** The shop overrides the computed reorder level, or hands it back to us. */
export async function saveReorderLevel(productId: string, level: number | null) {
  const { business } = await requireShop("retail.manage");
  if (!isValidObjectId(productId)) return { error: "invalid" };
  if (level !== null && (!Number.isInteger(level) || level < 0 || level > 100_000)) return { error: "invalid" };
  await setReorderLevel(business._id, productId, level);
  revalidatePath("/app/shop/alerts");
  return { ok: true };
}
