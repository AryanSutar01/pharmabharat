import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { accountRows } from "@/lib/ledger/service";
import { Business } from "@/lib/models/business";
import { Order } from "@/lib/models/order";
import { Recall } from "@/lib/models/recall";
import { bestOffers } from "@/lib/orders/reorder";
import { round2 } from "@/lib/orders/gst";

const DAY = 24 * 3600 * 1000;
/** A delivery with less than this much shelf life left is short-dated. */
const SHORT_DATED_MS = 180 * DAY;
/** Orders that count as a purchase. */
const COUNTED = { status: { $nin: ["rejected", "cancelled"] } };

export type SupplierRow = {
  sellerId: string;
  name: string;
  city: string;
  spend: number;
  orders: number;
  lastOrderAt: string;
  /** Credit the supplier gives this shop, from the ledger. */
  creditDays: number;
  creditLimit: number;
  outstanding: number;
  overdue: number;
  /** Batches received from them that were later recalled. */
  recalled: number;
  /** Deliveries that arrived with under six months of shelf life. */
  shortDated: number;
};

/**
 * Everyone the shop has bought from, with what it spent, what it still owes
 * and how often that supplier caused a problem.
 */
export async function supplierSummary(
  businessId: mongoose.Types.ObjectId,
  opts: { days?: number } = {},
): Promise<SupplierRow[]> {
  await connectDB();
  const since = opts.days ? new Date(Date.now() - opts.days * DAY) : new Date(0);

  const rows = await Order.aggregate<{
    _id: mongoose.Types.ObjectId;
    spend: number;
    orders: number;
    last: Date;
    batches: { batchNo: string; expiryDate: Date; at: Date }[];
  }>([
    { $match: { buyerId: businessId, ...COUNTED, createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$sellerId",
        spend: { $sum: "$totals.grandTotal" },
        orders: { $sum: 1 },
        last: { $max: "$createdAt" },
        batches: { $push: { batchNo: "$items.batchNo", expiryDate: "$items.expiryDate", at: "$createdAt" } },
      },
    },
    { $sort: { spend: -1 } },
    { $limit: 50 },
  ]);
  if (!rows.length) return [];

  // Flatten the per-order arrays into one list of delivered batches.
  const delivered = rows.map((r) => ({
    sellerId: String(r._id),
    batches: r.batches.flatMap((b) =>
      (b.batchNo as unknown as string[]).map((batchNo, i) => ({
        batchNo,
        expiryDate: new Date((b.expiryDate as unknown as Date[])[i]),
        at: new Date(b.at),
      })),
    ),
  }));

  const allBatchNos = [...new Set(delivered.flatMap((d) => d.batches.map((b) => b.batchNo.toUpperCase())))];
  const [sellers, recalls, ledger] = await Promise.all([
    Business.find({ _id: { $in: rows.map((r) => r._id) } }, { legalName: 1, tradeName: 1, address: 1 }).lean(),
    allBatchNos.length ? Recall.find({ batchNo: { $in: allBatchNos } }, { batchNo: 1 }).lean() : [],
    accountRows(businessId, "buyer"),
  ]);
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));
  const recalledBatches = new Set(recalls.map((r) => r.batchNo));
  const ledgerById = new Map(ledger.map((l) => [l.businessId, l]));

  return rows.map((r) => {
    const id = String(r._id);
    const seller = sellerById.get(id);
    const batches = delivered.find((d) => d.sellerId === id)?.batches ?? [];
    const credit = ledgerById.get(id);
    return {
      sellerId: id,
      name: seller ? seller.tradeName || seller.legalName : "—",
      city: seller?.address?.city ?? "",
      spend: round2(r.spend),
      orders: r.orders,
      lastOrderAt: new Date(r.last).toISOString(),
      creditDays: credit?.creditDays ?? 0,
      creditLimit: credit?.creditLimit ?? 0,
      outstanding: credit?.outstanding ?? 0,
      overdue: credit?.overdue ?? 0,
      recalled: batches.filter((b) => recalledBatches.has(b.batchNo.toUpperCase())).length,
      shortDated: batches.filter((b) => b.expiryDate.getTime() - b.at.getTime() < SHORT_DATED_MS).length,
    };
  });
}

export type PriceRow = {
  sellerId: string;
  name: string;
  lastPrice: number;
  lowestPrice: number;
  lastBoughtAt: string;
  packs: number;
  /** What they quote for it right now, if they still list it. */
  currentPrice: number | null;
};

/** The medicines this shop spends the most on, for the comparison picker. */
export async function topPurchased(businessId: mongoose.Types.ObjectId, limit = 20) {
  await connectDB();
  return Order.aggregate<{ _id: mongoose.Types.ObjectId; name: string; spend: number }>([
    { $match: { buyerId: businessId, ...COUNTED } },
    { $unwind: "$items" },
    { $group: { _id: "$items.productId", name: { $last: "$items.name" }, spend: { $sum: "$items.taxable" } } },
    { $sort: { spend: -1 } },
    { $limit: limit },
  ]);
}

/**
 * What each supplier charged this shop for one medicine, next to what they
 * are asking today — so a supplier who quietly got dearer is obvious.
 */
export async function priceComparison(
  businessId: mongoose.Types.ObjectId,
  productId: mongoose.Types.ObjectId,
): Promise<PriceRow[]> {
  await connectDB();
  const rows = await Order.aggregate<{
    _id: mongoose.Types.ObjectId;
    lastPrice: number;
    lowestPrice: number;
    last: Date;
    packs: number;
  }>([
    { $match: { buyerId: businessId, ...COUNTED, "items.productId": productId } },
    { $unwind: "$items" },
    { $match: { "items.productId": productId } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: "$sellerId",
        lastPrice: { $last: "$items.price" },
        lowestPrice: { $min: "$items.price" },
        last: { $max: "$createdAt" },
        packs: { $sum: "$items.qty" },
      },
    },
    { $sort: { lastPrice: 1 } },
  ]);
  if (!rows.length) return [];

  const [sellers, live] = await Promise.all([
    Business.find({ _id: { $in: rows.map((r) => r._id) } }, { legalName: 1, tradeName: 1 }).lean(),
    bestOffers([productId], businessId),
  ]);
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));
  const best = live.get(String(productId));

  return rows.map((r) => {
    const seller = sellerById.get(String(r._id));
    return {
      sellerId: String(r._id),
      name: seller ? seller.tradeName || seller.legalName : "—",
      lastPrice: round2(r.lastPrice),
      lowestPrice: round2(r.lowestPrice),
      lastBoughtAt: new Date(r.last).toISOString(),
      packs: r.packs,
      // The live catalogue only tells us the cheapest seller's price today.
      currentPrice: best && best.sellerId === String(r._id) ? best.price : null,
    };
  });
}

/** The cheapest live offer for a medicine, whoever it comes from. */
export async function bestLiveOffer(businessId: mongoose.Types.ObjectId, productId: mongoose.Types.ObjectId) {
  const offers = await bestOffers([productId], businessId);
  return offers.get(String(productId)) ?? null;
}
