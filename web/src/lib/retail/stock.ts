import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Order, type OrderDoc } from "@/lib/models/order";
import { ShopItem, ShopStock, type ShopStockDoc } from "@/lib/models/shop-stock";
import { inPacks, packsAndLoose, parsePackUnits } from "@/lib/retail/units";

const DAY = 24 * 3600 * 1000;
/** Batches with less than this left are flagged on the shelf. */
export const EXPIRY_LEVELS = [90, 60, 30] as const;

export type StockFilter = "all" | "expiring" | "expired" | "low" | "out";

export type StockRow = {
  id: string;
  productId: string;
  name: string;
  manufacturer: string;
  packSizeLabel: string;
  batchNo: string;
  expiryDate: string;
  daysToExpiry: number;
  /** On the shelf, in the smallest sellable unit. */
  units: number;
  unitsPerPack: number;
  /** The same quantity as the shop sees it: 11 strips and 11 loose. */
  packs: number;
  loose: number;
  cost: number;
  mrp: number;
  gstRate: number;
  value: number;
  supplierName: string;
  source: string;
};

function toRow(s: ShopStockDoc, now: number): StockRow {
  return {
    id: String(s._id),
    productId: String(s.productId),
    name: s.name,
    manufacturer: s.manufacturer ?? "",
    packSizeLabel: s.packSizeLabel ?? "",
    batchNo: s.batchNo,
    expiryDate: new Date(s.expiryDate).toISOString(),
    daysToExpiry: Math.ceil((new Date(s.expiryDate).getTime() - now) / DAY),
    units: s.units,
    unitsPerPack: s.unitsPerPack ?? 1,
    packs: packsAndLoose(s.units, s.unitsPerPack ?? 1).packs,
    loose: packsAndLoose(s.units, s.unitsPerPack ?? 1).loose,
    cost: s.cost,
    mrp: s.mrp,
    gstRate: s.gstRate,
    // Part of a strip is still money on the shelf, so value the fraction.
    value: Math.round(inPacks(s.units, s.unitsPerPack ?? 1) * s.cost * 100) / 100,
    supplierName: s.supplierName ?? "",
    source: s.source ?? "manual",
  };
}

/** The shelf, filtered the way the shop thinks about it. */
export async function listStock(
  businessId: mongoose.Types.ObjectId,
  opts: { filter?: StockFilter; q?: string; limit?: number } = {},
) {
  await connectDB();
  const now = new Date();
  const filter: Record<string, unknown> = { businessId };

  if (opts.filter === "expiring") {
    filter.expiryDate = { $gt: now, $lte: new Date(now.getTime() + EXPIRY_LEVELS[0] * DAY) };
    filter.units = { $gt: 0 };
  } else if (opts.filter === "expired") {
    filter.expiryDate = { $lte: now };
    filter.units = { $gt: 0 };
  } else if (opts.filter === "out") {
    filter.units = { $lte: 0 };
  }
  if (opts.q) filter.name = { $regex: opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  const rows = await ShopStock.find(filter).sort({ expiryDate: 1 }).limit(opts.limit ?? 300).lean();
  return rows.map((r) => toRow(r as ShopStockDoc, now.getTime()));
}

/** Headline numbers for the shop stock page. */
export async function stockSummary(businessId: mongoose.Types.ObjectId, now = new Date()) {
  await connectDB();
  // Money is per pack, so divide the units back into packs before multiplying.
  const perPack = { $divide: ["$units", { $max: [{ $ifNull: ["$unitsPerPack", 1] }, 1] }] };
  const [agg] = await ShopStock.aggregate<{ batches: number; packs: number; value: number; retail: number }>([
    { $match: { businessId, units: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        batches: { $sum: 1 },
        packs: { $sum: perPack },
        value: { $sum: { $multiply: [perPack, "$cost"] } },
        retail: { $sum: { $multiply: [perPack, "$mrp"] } },
      },
    },
  ]);
  const soon = new Date(now.getTime() + EXPIRY_LEVELS[0] * DAY);
  const [expiring, expired] = await Promise.all([
    ShopStock.countDocuments({ businessId, units: { $gt: 0 }, expiryDate: { $gt: now, $lte: soon } }),
    ShopStock.countDocuments({ businessId, units: { $gt: 0 }, expiryDate: { $lte: now } }),
  ]);
  return {
    batches: agg?.batches ?? 0,
    packs: Math.round((agg?.packs ?? 0) * 100) / 100,
    value: Math.round((agg?.value ?? 0) * 100) / 100,
    retail: Math.round((agg?.retail ?? 0) * 100) / 100,
    expiring,
    expired,
  };
}

export type StockInput = {
  productId: mongoose.Types.ObjectId | string;
  name: string;
  manufacturer?: string;
  packSizeLabel?: string;
  batchNo: string;
  expiryDate: Date;
  mfgDate?: Date;
  /** Packs received — converted to units using `unitsPerPack`. */
  qty: number;
  /** Units in a pack; 1 (the default) means the pack cannot be split. */
  unitsPerPack?: number;
  cost: number;
  mrp: number;
  gstRate: number;
  hsn?: string;
  schedule?: string;
  supplierId?: mongoose.Types.ObjectId;
  supplierName?: string;
  orderId?: mongoose.Types.ObjectId;
  source?: "order" | "manual" | "csv";
};

/**
 * Adds a batch to the shelf, topping up the quantity if that batch is already
 * there. The price details of the newest receipt win, so the margin reports
 * follow what the shop last paid.
 */
export async function addStock(
  businessId: mongoose.Types.ObjectId,
  input: StockInput,
  userId: string,
  session?: mongoose.ClientSession,
) {
  const batchNo = input.batchNo.trim().toUpperCase();
  // A batch already on the shelf keeps its pack size: topping it up must never
  // silently redefine how many tablets a strip holds, or the count would lie.
  const existing = await ShopStock.findOne({ businessId, productId: input.productId, batchNo }, { unitsPerPack: 1 })
    .session(session ?? null)
    .lean();
  const unitsPerPack = Math.max(
    Math.floor(input.unitsPerPack ?? existing?.unitsPerPack ?? parsePackUnits(input.packSizeLabel) ?? 1),
    1,
  );
  await ShopStock.updateOne(
    { businessId, productId: input.productId, batchNo },
    {
      $inc: { units: input.qty * unitsPerPack },
      $set: {
        unitsPerPack,
        name: input.name,
        manufacturer: input.manufacturer,
        packSizeLabel: input.packSizeLabel,
        expiryDate: input.expiryDate,
        mfgDate: input.mfgDate,
        cost: input.cost,
        mrp: input.mrp,
        gstRate: input.gstRate,
        hsn: input.hsn,
        schedule: input.schedule,
        supplierId: input.supplierId,
        supplierName: input.supplierName,
        orderId: input.orderId,
        source: input.source ?? "manual",
        receivedAt: new Date(),
        addedBy: userId,
      },
    },
    { upsert: true, session },
  );
  await ShopItem.updateOne(
    { businessId, productId: input.productId },
    { $setOnInsert: { name: input.name } },
    { upsert: true, session },
  );
}

/**
 * Puts a delivered order onto the shop's shelf. Idempotent: an order already
 * received is skipped, so re-marking a delivery changes nothing.
 */
export async function receiveOrder(order: OrderDoc, userId: string) {
  await connectDB();
  if (await ShopStock.exists({ businessId: order.buyerId, orderId: order._id })) return { added: 0 };
  // A purchase order is always in whole packs; how many tablets those hold
  // comes from the catalogue label and can be corrected on the shelf.
  for (const item of order.items) {
    await addStock(
      order.buyerId,
      {
        productId: item.productId,
        name: item.name,
        manufacturer: item.manufacturer ?? undefined,
        packSizeLabel: item.packSizeLabel ?? undefined,
        batchNo: item.batchNo,
        expiryDate: new Date(item.expiryDate),
        qty: item.qty,
        cost: item.price,
        mrp: item.mrp,
        gstRate: item.gstRate,
        hsn: item.hsn ?? undefined,
        supplierId: order.sellerId,
        supplierName: order.seller?.name,
        orderId: order._id,
        source: "order",
      },
      userId,
    );
  }
  return { added: order.items.length };
}

/** Best-effort: a delivery must never fail because the shelf update did. */
export async function receiveOrderSafely(orderId: mongoose.Types.ObjectId | string, userId: string) {
  try {
    await connectDB();
    const order = await Order.findById(orderId).lean();
    if (order) await receiveOrder(order as OrderDoc, userId);
  } catch (err) {
    console.error("receiveOrder failed", err);
  }
}

/** Corrects the count on a batch, in units (breakage, a write-off, a miscount). */
export async function setStockUnits(businessId: mongoose.Types.ObjectId, stockId: string, units: number) {
  await connectDB();
  await ShopStock.updateOne({ _id: stockId, businessId }, { $set: { units: Math.max(Math.floor(units), 0) } });
}

export async function removeStock(businessId: mongoose.Types.ObjectId, stockId: string) {
  await connectDB();
  await ShopStock.deleteOne({ _id: stockId, businessId });
}
