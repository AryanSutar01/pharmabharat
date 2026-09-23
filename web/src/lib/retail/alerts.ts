import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Business } from "@/lib/models/business";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { shopSettings } from "@/lib/models/shop-settings";
import { round2 } from "@/lib/orders/gst";
import { notify } from "@/lib/notifications";
import { inPacks, packsAndLoose } from "@/lib/retail/units";

const DAY = 24 * 3600 * 1000;
/** Warning levels for stock nearing expiry, in days. */
export const SHOP_EXPIRY_LEVELS = [90, 60, 30] as const;
export type ShopExpiryLevel = (typeof SHOP_EXPIRY_LEVELS)[number];
/** Sales are averaged over this window to work out how fast something moves. */
const VELOCITY_WINDOW_DAYS = 90;

/** The tightest level a batch has reached, or null if it is still far off. */
export function dueExpiryLevel(daysLeft: number, lastSent: number | null | undefined): ShopExpiryLevel | null {
  if (daysLeft <= 0) return null; // already expired: it shows as expired, not as a warning
  const level = [...SHOP_EXPIRY_LEVELS].reverse().find((l) => daysLeft <= l);
  if (!level) return null;
  if (lastSent != null && level >= lastSent) return null;
  return level;
}

export type ExpiryRow = {
  id: string;
  productId: string;
  name: string;
  batchNo: string;
  expiryDate: string;
  daysLeft: number;
  units: number;
  packs: number;
  loose: number;
  /** Money tied up in this batch, at what the shop paid. */
  value: number;
  bucket: ShopExpiryLevel | "expired";
};

/** Batches that have expired or will within 90 days, worst first. */
export async function expiringStock(businessId: mongoose.Types.ObjectId, now = new Date()): Promise<ExpiryRow[]> {
  await connectDB();
  const rows = await ShopStock.find({
    businessId,
    units: { $gt: 0 },
    expiryDate: { $lte: new Date(now.getTime() + SHOP_EXPIRY_LEVELS[0] * DAY) },
  })
    .sort({ expiryDate: 1 })
    .limit(500)
    .lean();

  return rows.map((r) => {
    const daysLeft = Math.ceil((new Date(r.expiryDate).getTime() - now.getTime()) / DAY);
    return {
      id: String(r._id),
      productId: String(r.productId),
      name: r.name,
      batchNo: r.batchNo,
      expiryDate: new Date(r.expiryDate).toISOString(),
      daysLeft,
      units: r.units,
      packs: packsAndLoose(r.units, r.unitsPerPack ?? 1).packs,
      loose: packsAndLoose(r.units, r.unitsPerPack ?? 1).loose,
      value: round2(inPacks(r.units, r.unitsPerPack ?? 1) * r.cost),
      bucket: daysLeft <= 0 ? ("expired" as const) : ([...SHOP_EXPIRY_LEVELS].reverse().find((l) => daysLeft <= l) ?? 90),
    };
  });
}

export type LowStockRow = {
  productId: string;
  name: string;
  inStock: number;
  reorderLevel: number;
  dailySales: number;
  /** Packs to buy to get back to the cover period. */
  suggestedQty: number;
  daysLeft: number | null;
  lastSoldAt: string | null;
};

/**
 * What the shop is about to run out of. Compares the packs on the shelf with
 * the reorder level worked out from how fast the medicine actually sells.
 */
export async function lowStock(businessId: mongoose.Types.ObjectId, limit = 200): Promise<LowStockRow[]> {
  await connectDB();
  const { reorderCoverDays } = await shopSettings(businessId);

  const items = await ShopItem.find({ businessId, $or: [{ reorderLevel: { $gt: 0 } }, { dailySales: { $gt: 0 } }] })
    .limit(1000)
    .lean();
  if (!items.length) return [];

  // Reorder levels are in packs - that is how the shop buys - so bring the
  // shelf back to packs, counting a cut strip as the fraction it is.
  const onShelf = await ShopStock.aggregate<{ _id: mongoose.Types.ObjectId; packs: number }>([
    {
      $match: {
        businessId,
        productId: { $in: items.map((i) => i.productId) },
        units: { $gt: 0 },
        expiryDate: { $gt: new Date() },
      },
    },
    {
      $group: {
        _id: "$productId",
        packs: { $sum: { $divide: ["$units", { $max: [{ $ifNull: ["$unitsPerPack", 1] }, 1] }] } },
      },
    },
  ]);
  const qtyById = new Map(onShelf.map((r) => [String(r._id), Math.floor(r.packs * 100) / 100]));

  return items
    .map((i) => {
      const inStock = qtyById.get(String(i.productId)) ?? 0;
      const reorderLevel = i.reorderLevel ?? 0;
      const dailySales = i.dailySales ?? 0;
      return {
        productId: String(i.productId),
        name: i.name,
        inStock,
        reorderLevel,
        dailySales: Math.round(dailySales * 100) / 100,
        suggestedQty: Math.max(Math.ceil(dailySales * reorderCoverDays) - inStock, 1),
        daysLeft: dailySales > 0 ? Math.floor(inStock / dailySales) : null,
        lastSoldAt: i.lastSoldAt ? new Date(i.lastSoldAt).toISOString() : null,
      };
    })
    .filter((r) => r.inStock <= r.reorderLevel)
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999) || b.dailySales - a.dailySales)
    .slice(0, limit);
}

/**
 * Nightly: work out how fast each medicine sells and set its reorder level to
 * cover the shop's chosen number of days. A level the shop typed by hand is
 * left alone.
 */
export async function computeReorderLevels(businessId: mongoose.Types.ObjectId, now = new Date()) {
  await connectDB();
  const { reorderCoverDays } = await shopSettings(businessId);
  const since = new Date(now.getTime() - VELOCITY_WINDOW_DAYS * DAY);

  // Lines are recorded in units; a day's sales are expressed in packs so the
  // reorder level is something the shop can actually order.
  const sold = await Bill.aggregate<{ _id: mongoose.Types.ObjectId; packs: number; last: Date }>([
    { $match: { businessId, status: "final", createdAt: { $gte: since } } },
    { $unwind: "$lines" },
    {
      $group: {
        _id: "$lines.productId",
        packs: { $sum: { $divide: ["$lines.units", { $max: [{ $ifNull: ["$lines.unitsPerPack", 1] }, 1] }] } },
        last: { $max: "$createdAt" },
      },
    },
  ]);
  const soldById = new Map(sold.map((s) => [String(s._id), s]));

  const items = await ShopItem.find({ businessId }).limit(5000).lean();
  const writes = items.map((item) => {
    const row = soldById.get(String(item.productId));
    const dailySales = row ? row.packs / VELOCITY_WINDOW_DAYS : 0;
    const set: Record<string, unknown> = { dailySales, computedAt: now };
    if (row?.last) set.lastSoldAt = row.last;
    // A hand-set level is the shop's decision; only compute the rest.
    if (!item.manualReorderLevel) set.reorderLevel = Math.ceil(dailySales * reorderCoverDays);
    return { updateOne: { filter: { _id: item._id }, update: { $set: set } } };
  });
  if (writes.length) await ShopItem.bulkWrite(writes);
  return { items: writes.length };
}

/** The shop sets its own minimum for a medicine, overriding the computed one. */
export async function setReorderLevel(businessId: mongoose.Types.ObjectId, productId: string, level: number | null) {
  await connectDB();
  await ShopItem.updateOne(
    { businessId, productId },
    level === null
      ? { $set: { manualReorderLevel: false } }
      : { $set: { manualReorderLevel: true, reorderLevel: Math.max(Math.round(level), 0) } },
  );
}

/**
 * Daily alerts for one shop: batches crossing a 90 / 60 / 30-day expiry level,
 * and a low-stock nudge. Each batch is only warned about once per level.
 */
export async function runShopAlerts(businessId: mongoose.Types.ObjectId, now = new Date()) {
  await connectDB();
  const batches = await ShopStock.find({
    businessId,
    units: { $gt: 0 },
    expiryDate: { $gt: now, $lte: new Date(now.getTime() + SHOP_EXPIRY_LEVELS[0] * DAY) },
  })
    .limit(1000)
    .lean();

  const due: { id: mongoose.Types.ObjectId; level: ShopExpiryLevel; daysLeft: number; value: number }[] = [];
  for (const b of batches) {
    const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / DAY);
    const level = dueExpiryLevel(daysLeft, b.expiryAlertLevel);
    if (level) due.push({ id: b._id, level, daysLeft, value: inPacks(b.units, b.unitsPerPack ?? 1) * b.cost });
  }

  if (due.length) {
    await notify({
      businessId,
      permission: "retail.manage",
      kind: "shop_expiry",
      params: {
        count: due.length,
        days: Math.min(...due.map((d) => d.level)),
        value: round2(due.reduce((a, d) => a + d.value, 0)),
      },
      link: "/app/shop/alerts",
    });
    await ShopStock.bulkWrite(
      due.map((d) => ({ updateOne: { filter: { _id: d.id }, update: { $set: { expiryAlertLevel: d.level } } } })),
    );
  }

  const low = await lowStock(businessId, 50);
  if (low.length) {
    await notify({
      businessId,
      permission: "retail.manage",
      kind: "shop_low_stock",
      params: { count: low.length, name: low[0].name },
      link: "/app/shop/alerts?tab=low",
    });
  }

  return { expiring: due.length, low: low.length };
}

/** Every approved shop, for the daily job. */
export async function shopIds(limit = 500) {
  await connectDB();
  const rows = await Business.find({ type: "retailer", "kyc.status": "approved" }, { _id: 1 }).limit(limit).lean();
  return rows.map((r) => r._id);
}
