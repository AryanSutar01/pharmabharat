import "server-only";
import type mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { sendMail } from "@/lib/mail";
import { recallEmail } from "@/lib/mail/templates";
import { Business } from "@/lib/models/business";
import { Listing } from "@/lib/models/listing";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { Recall, type RecallDoc, type RecallSeverity } from "@/lib/models/recall";
import { notify } from "@/lib/notifications";
import { getUsersByIds } from "@/lib/users";

/** Orders old enough to still matter to the buyer (2 years of shelf life). */
const ORDER_WINDOW_MS = 2 * 365 * 24 * 3600 * 1000;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Products whose name matches what the admin typed (the batch number does the real work). */
async function matchingProductIds(productName: string, manufacturer?: string) {
  const products = await Product.find(
    {
      name: { $regex: escapeRegExp(productName.trim()), $options: "i" },
      ...(manufacturer ? { manufacturer: { $regex: escapeRegExp(manufacturer.trim()), $options: "i" } } : {}),
    },
    { _id: 1 },
  )
    .limit(500)
    .lean();
  return products.map((p) => p._id);
}

export type RecallInput = {
  productName: string;
  manufacturer?: string;
  batchNo: string;
  severity: RecallSeverity;
  reason: string;
  reference?: string;
  user: { id: string; name: string };
};

/**
 * Issues a recall: holds every matching listing, then tells the sellers who
 * stock that batch and the buyers who already bought it.
 */
export async function issueRecall(input: RecallInput) {
  await connectDB();
  const batchNo = input.batchNo.trim().toUpperCase();
  const productIds = await matchingProductIds(input.productName, input.manufacturer);

  const recall = await Recall.create({
    productName: input.productName.trim(),
    manufacturer: input.manufacturer?.trim(),
    batchNo,
    severity: input.severity,
    reason: input.reason,
    reference: input.reference,
    issuedBy: input.user.id,
    issuedByName: input.user.name,
  });

  const scope = { batchNo, ...(productIds.length ? { productId: { $in: productIds } } : {}) };
  const listings = await Listing.find(scope, { sellerId: 1, stock: 1 }).lean();
  if (listings.length) {
    await Listing.updateMany(
      { _id: { $in: listings.map((l) => l._id) } },
      {
        $set: {
          status: "paused",
          recallId: recall._id,
          moderation: {
            held: true,
            reason: `${input.severity === "advisory" ? "Advisory" : "Recall"}: batch ${batchNo}`,
            by: input.user.id,
            at: new Date(),
          },
        },
      },
    );
  }

  // Buyers who already received this batch, from orders that were not cancelled.
  const since = new Date(Date.now() - ORDER_WINDOW_MS);
  const orders = await Order.find(
    {
      createdAt: { $gte: since },
      status: { $in: ["accepted", "packed", "dispatched", "delivered"] },
      items: { $elemMatch: { batchNo, ...(productIds.length ? { productId: { $in: productIds } } : {}) } },
    },
    { buyerId: 1, orderNo: 1 },
  )
    .limit(2000)
    .lean();

  const sellerIds = [...new Set(listings.map((l) => String(l.sellerId)))];
  const buyerIds = [...new Set(orders.map((o) => String(o.buyerId)))];
  await broadcast(recall, sellerIds, buyerIds);

  recall.stats = { listings: listings.length, sellers: sellerIds.length, orders: orders.length, buyers: buyerIds.length };
  await recall.save();
  return recall.toObject() as RecallDoc;
}

/** In-app notice to everyone affected, plus an email to each business. */
async function broadcast(recall: RecallDoc, sellerIds: string[], buyerIds: string[]) {
  const businesses = await Business.find(
    { _id: { $in: [...new Set([...sellerIds, ...buyerIds])] } },
    { legalName: 1, tradeName: 1, email: 1, ownerUserId: 1 },
  ).lean();
  const owners = await getUsersByIds(businesses.map((b) => b.ownerUserId));
  const sellerSet = new Set(sellerIds);
  const params = { product: recall.productName, batchNo: recall.batchNo };

  for (const b of businesses) {
    const isSeller = sellerSet.has(String(b._id));
    await notify({
      businessId: b._id,
      permission: isSeller ? "inventory.manage" : "orders.place",
      kind: "batch_recall",
      params,
      link: isSeller ? "/app/inventory" : "/app/orders?filter=all",
    });
    const mail = recallEmail({
      businessName: b.tradeName || b.legalName,
      audience: isSeller ? "seller" : "buyer",
      productName: recall.productName,
      manufacturer: recall.manufacturer ?? undefined,
      batchNo: recall.batchNo,
      severity: recall.severity as RecallSeverity,
      reason: recall.reason,
      reference: recall.reference ?? undefined,
    });
    for (const to of new Set([b.email, owners.get(b.ownerUserId)?.email].filter((e): e is string => Boolean(e)))) {
      await sendMail({ to, ...mail });
    }
  }
}

/** Withdraws a recall and releases the listings it held (they stay paused). */
export async function withdrawRecall(recallId: mongoose.Types.ObjectId | string, userId: string) {
  await connectDB();
  const recall = await Recall.findOneAndUpdate(
    { _id: recallId, status: "active" },
    { $set: { status: "withdrawn", withdrawnAt: new Date(), withdrawnBy: userId } },
    { returnDocument: "after" },
  ).lean();
  if (!recall) return null;
  await Listing.updateMany(
    { recallId: recall._id },
    { $set: { "moderation.held": false, recallId: null }, $unset: { "moderation.reason": 1 } },
  );
  return recall;
}

/** Active recalls covering any of these batch numbers (used on the order page). */
export async function recallsForBatches(batchNos: string[]) {
  if (!batchNos.length) return [];
  await connectDB();
  return Recall.find(
    { status: "active", batchNo: { $in: [...new Set(batchNos.map((b) => b.trim().toUpperCase()))] } },
    { productName: 1, batchNo: 1, severity: 1, reason: 1, reference: 1 },
  ).lean();
}
