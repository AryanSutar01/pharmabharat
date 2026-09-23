import "server-only";
import type mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Customer } from "@/lib/models/customer";
import { LoyaltyEntry } from "@/lib/models/loyalty";
import { shopSettings } from "@/lib/models/shop-settings";
import { expiredPoints } from "@/lib/retail/loyalty";

/** A customer's points movements, newest first, for their profile. */
export async function loyaltyHistory(businessId: mongoose.Types.ObjectId, customerId: string, limit = 30) {
  await connectDB();
  return LoyaltyEntry.find({ businessId, customerId }).sort({ createdAt: -1 }).limit(limit).lean();
}

/**
 * Nightly: lapse points that were never used. Redemptions are applied to the
 * oldest points first, so only genuinely unused batches expire.
 */
export async function expireLoyaltyPoints(businessId: mongoose.Types.ObjectId, now = new Date()) {
  await connectDB();
  const { loyalty } = await shopSettings(businessId);
  if (!loyalty.active) return { customers: 0, points: 0 };

  const customers = await Customer.find({ businessId, loyaltyPoints: { $gt: 0 } }, { _id: 1 }).limit(1000).lean();
  let touched = 0;
  let lapsed = 0;

  for (const c of customers) {
    const entries = await LoyaltyEntry.find({ businessId, customerId: c._id }).sort({ createdAt: 1 }).lean();
    const { expired } = expiredPoints(
      entries.map((e) => ({ id: String(e._id), points: e.points, createdAt: new Date(e.createdAt), expiresAt: e.expiresAt })),
      now,
    );
    if (expired <= 0) continue;
    await LoyaltyEntry.create({
      businessId,
      customerId: c._id,
      kind: "expired",
      points: -expired,
      note: `Points unused for ${loyalty.expiryMonths} months`,
    });
    await Customer.updateOne({ _id: c._id }, { $inc: { loyaltyPoints: -expired } });
    touched += 1;
    lapsed += expired;
  }
  return { customers: touched, points: lapsed };
}
