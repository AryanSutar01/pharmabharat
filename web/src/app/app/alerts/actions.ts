"use server";

import { revalidatePath } from "next/cache";
import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";
import { bestPrices } from "@/lib/alerts/price";
import { PRICE_DIRECTIONS } from "@/lib/alerts/rules";
import { connectDB } from "@/lib/db/mongo";
import { PriceAlert } from "@/lib/models/price-alert";
import { Product } from "@/lib/models/product";
import { markAllRead } from "@/lib/notifications";
import { requireBusiness } from "@/lib/session";

export type AlertFormState = { ok?: boolean; error?: string };

const MAX_ALERTS = 200;

const schema = z.object({
  direction: z.enum(PRICE_DIRECTIONS),
  thresholdPct: z.coerce.number().min(0).max(90),
  email: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function savePriceAlert(productId: string, _: AlertFormState, formData: FormData): Promise<AlertFormState> {
  const { business, session } = await requireBusiness();
  if (!isValidObjectId(productId)) return { error: "invalid" };
  const parsed = schema.safeParse({
    direction: formData.get("direction"),
    thresholdPct: formData.get("thresholdPct") || 0,
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: "invalid" };

  await connectDB();
  if (!(await Product.exists({ _id: productId }))) return { error: "not_found" };
  const filter = { userId: session.user.id, businessId: business._id, productId };
  const existing = await PriceAlert.findOne(filter, { _id: 1 }).lean();
  if (!existing && (await PriceAlert.countDocuments({ userId: session.user.id, businessId: business._id })) >= MAX_ALERTS) {
    return { error: "alerts_full" };
  }
  // Reference = today's best price, so the first alert reports a real change from now.
  const current = (await bestPrices([new Types.ObjectId(productId)])).get(productId) ?? null;
  await PriceAlert.updateOne(
    filter,
    { $set: { ...parsed.data, referencePrice: current } },
    { upsert: true },
  );
  revalidatePath(`/app/catalog/${productId}`);
  revalidatePath("/app/alerts");
  return { ok: true };
}

export async function deletePriceAlert(alertId: string) {
  const { business, session } = await requireBusiness();
  if (!isValidObjectId(alertId)) return;
  await connectDB();
  const a = await PriceAlert.findOneAndDelete({ _id: alertId, userId: session.user.id, businessId: business._id }).lean();
  if (a) revalidatePath(`/app/catalog/${a.productId}`);
  revalidatePath("/app/alerts");
}

export async function markNotificationsRead() {
  const { business, session } = await requireBusiness();
  await markAllRead(session.user.id, business._id);
  revalidatePath("/app", "layout");
}
