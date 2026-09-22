import "server-only";
import { connectDB } from "@/lib/db/mongo";
import { sendMail } from "@/lib/mail";
import { expiryDigestEmail } from "@/lib/mail/templates";
import { Business } from "@/lib/models/business";
import { Listing } from "@/lib/models/listing";
import { Product } from "@/lib/models/product";
import { notify } from "@/lib/notifications";
import { getUsersByIds } from "@/lib/users";
import { dueExpiryLevel, EXPIRY_LEVELS, type ExpiryLevel } from "./rules";

const DAY = 24 * 3600 * 1000;
const MAX_PER_RUN = 5000;

/**
 * Daily job: warn sellers about stock nearing expiry at 90 / 60 / 30 days.
 * Idempotent — each listing records the last level sent, so re-running the
 * same day sends nothing new.
 */
export async function runExpiryAlerts(now = new Date()) {
  await connectDB();
  const horizon = new Date(now.getTime() + EXPIRY_LEVELS[0] * DAY);
  const listings = await Listing.find(
    { stock: { $gt: 0 }, expiryDate: { $gt: now, $lte: horizon } },
    { sellerId: 1, productId: 1, batchNo: 1, expiryDate: 1, stock: 1, expiryAlertLevel: 1 },
  )
    .limit(MAX_PER_RUN)
    .lean();

  type Due = (typeof listings)[number] & { level: ExpiryLevel; daysLeft: number };
  const due: Due[] = [];
  for (const l of listings) {
    const daysLeft = Math.ceil((new Date(l.expiryDate).getTime() - now.getTime()) / DAY);
    const level = dueExpiryLevel(daysLeft, l.expiryAlertLevel as ExpiryLevel | null);
    if (level) due.push({ ...l, level, daysLeft });
  }
  if (!due.length) return { sellers: 0, listings: 0 };

  const products = await Product.find({ _id: { $in: due.map((d) => d.productId) } }, { name: 1 }).lean();
  const nameById = new Map(products.map((p) => [String(p._id), p.name]));
  const bySeller = new Map<string, Due[]>();
  for (const d of due) bySeller.set(String(d.sellerId), [...(bySeller.get(String(d.sellerId)) ?? []), d]);

  const sellers = await Business.find({ _id: { $in: [...bySeller.keys()] } }, { email: 1, ownerUserId: 1, tradeName: 1, legalName: 1 }).lean();
  const owners = await getUsersByIds(sellers.map((s) => s.ownerUserId));

  for (const s of sellers) {
    const items = bySeller.get(String(s._id))!.sort((a, b) => a.daysLeft - b.daysLeft);
    await notify({
      businessId: s._id,
      permission: "inventory.manage",
      kind: "expiry_soon",
      params: { count: items.length, days: Math.min(...items.map((i) => i.level)) },
      link: "/app/inventory?filter=expiring",
    });
    const mail = expiryDigestEmail({
      businessName: s.tradeName || s.legalName,
      items: items.map((i) => ({
        name: nameById.get(String(i.productId)) ?? "",
        batchNo: i.batchNo,
        expiryDate: new Date(i.expiryDate),
        daysLeft: i.daysLeft,
        stock: i.stock,
      })),
    });
    for (const to of new Set([s.email, owners.get(s.ownerUserId)?.email].filter((e): e is string => Boolean(e)))) {
      await sendMail({ to, ...mail });
    }
  }

  await Listing.bulkWrite(
    due.map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: { expiryAlertLevel: d.level } } } })),
  );
  return { sellers: sellers.length, listings: due.length };
}
