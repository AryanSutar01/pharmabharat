import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { offerSummaries } from "@/lib/catalog/queries";
import { sendMail } from "@/lib/mail";
import { priceAlertEmail } from "@/lib/mail/templates";
import { PriceAlert } from "@/lib/models/price-alert";
import { Product } from "@/lib/models/product";
import { notify } from "@/lib/notifications";
import { getUsersByIds } from "@/lib/users";
import { pctChange, shouldNotifyPrice, type PriceDirection } from "./rules";

/** Current best price per product (only from sellable listings). */
export async function bestPrices(productIds: mongoose.Types.ObjectId[]) {
  const offers = await offerSummaries(productIds);
  return new Map([...offers].map(([id, o]) => [id, o.bestPrice]));
}

/**
 * Re-evaluates price alerts for products whose listings just changed.
 * Called (via after()) from every place that can move a best price:
 * listing edits, pause/delete, stock updates, CSV import, checkout, cancellations.
 */
export async function checkPriceAlerts(productIds: (mongoose.Types.ObjectId | string)[]) {
  const ids = [...new Set(productIds.map(String))].filter(mongoose.isValidObjectId).map((id) => new mongoose.Types.ObjectId(id));
  if (!ids.length) return;
  await connectDB();
  const alerts = await PriceAlert.find({ productId: { $in: ids } }).lean();
  if (!alerts.length) return;

  const prices = await bestPrices(ids);
  const products = await Product.find({ _id: { $in: ids } }, { name: 1 }).lean();
  const nameById = new Map(products.map((p) => [String(p._id), p.name]));
  const emailUsers = await getUsersByIds(alerts.filter((a) => a.email).map((a) => a.userId));

  for (const a of alerts) {
    const current = prices.get(String(a.productId));
    if (current === undefined) continue; // nobody selling right now: keep the old reference
    if (a.referencePrice == null) {
      // First seller appeared after subscribing: start tracking from here.
      await PriceAlert.updateOne({ _id: a._id }, { $set: { referencePrice: current } });
      continue;
    }
    const fire = shouldNotifyPrice({
      reference: a.referencePrice,
      current,
      direction: a.direction as PriceDirection,
      thresholdPct: a.thresholdPct ?? 0,
    });
    if (!fire) continue;

    const productName = nameById.get(String(a.productId)) ?? "";
    const change = pctChange(a.referencePrice, current);
    const kind = current < a.referencePrice ? "price_drop" : "price_rise";
    const link = `/app/catalog/${a.productId}`;
    await notify({
      businessId: a.businessId,
      userIds: [a.userId],
      kind,
      params: { product: productName, from: a.referencePrice, to: current, change: Math.abs(change) },
      link,
    });
    const to = a.email ? emailUsers.get(a.userId)?.email : undefined;
    if (to) {
      await sendMail({ to, ...priceAlertEmail({ productName, from: a.referencePrice, to: current, change, link }) });
    }
    await PriceAlert.updateOne({ _id: a._id }, { $set: { referencePrice: current, lastNotifiedAt: new Date() } });
  }
}

/** Swallows errors: alerts must never break the action that triggered them. */
export function checkPriceAlertsSafely(productIds: (mongoose.Types.ObjectId | string)[]) {
  return checkPriceAlerts(productIds).catch((err) => console.error("[alerts] price check failed", err));
}
