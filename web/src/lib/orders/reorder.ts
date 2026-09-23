import "server-only";
import mongoose from "mongoose";
import { sellableFilter } from "@/lib/catalog/queries";
import { connectDB } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { Listing } from "@/lib/models/listing";
import { Order } from "@/lib/models/order";
import { NAME_COLLATION, Product } from "@/lib/models/product";
import type { ParsedLine } from "@/lib/orders/quick-list";

const CANDIDATES_PER_PRODUCT = 5;
const MAX_FUZZY_LOOKUPS = 60;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type BestOffer = {
  listingId: string;
  sellerId: string;
  sellerName: string;
  price: number;
  mrp: number;
  stock: number;
  minOrderQty: number;
  batchNo: string;
  expiryDate: string;
};

/**
 * Cheapest sellable listing per product, ignoring the buyer's own stock and
 * sellers who are not verified. Shared by "buy again" and the quick order list.
 */
export async function bestOffers(productIds: mongoose.Types.ObjectId[], buyerId: mongoose.Types.ObjectId) {
  const out = new Map<string, BestOffer>();
  if (!productIds.length) return out;
  await connectDB();

  const rows = await Listing.aggregate<{
    _id: mongoose.Types.ObjectId;
    offers: {
      _id: mongoose.Types.ObjectId;
      sellerId: mongoose.Types.ObjectId;
      price: number;
      mrp: number;
      stock: number;
      minOrderQty: number;
      batchNo: string;
      expiryDate: Date;
    }[];
  }>([
    { $match: { productId: { $in: productIds }, sellerId: { $ne: buyerId }, ...sellableFilter() } },
    { $sort: { price: 1 } },
    {
      $group: {
        _id: "$productId",
        offers: {
          $push: {
            _id: "$_id",
            sellerId: "$sellerId",
            price: "$price",
            mrp: "$mrp",
            stock: "$stock",
            minOrderQty: "$minOrderQty",
            batchNo: "$batchNo",
            expiryDate: "$expiryDate",
          },
        },
      },
    },
    { $project: { offers: { $slice: ["$offers", CANDIDATES_PER_PRODUCT] } } },
  ]);
  if (!rows.length) return out;

  // Only verified sellers may be auto-selected.
  const sellerIds = [...new Set(rows.flatMap((r) => r.offers.map((o) => String(o.sellerId))))];
  const sellers = await Business.find(
    { _id: { $in: sellerIds }, "kyc.status": "approved" },
    { legalName: 1, tradeName: 1 },
  ).lean();
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));

  for (const row of rows) {
    const offer = row.offers.find((o) => sellerById.has(String(o.sellerId)));
    if (!offer) continue;
    const seller = sellerById.get(String(offer.sellerId))!;
    out.set(String(row._id), {
      listingId: String(offer._id),
      sellerId: String(offer.sellerId),
      sellerName: seller.tradeName || seller.legalName,
      price: offer.price,
      mrp: offer.mrp,
      stock: offer.stock,
      minOrderQty: offer.minOrderQty ?? 1,
      batchNo: offer.batchNo,
      expiryDate: new Date(offer.expiryDate).toISOString(),
    });
  }
  return out;
}

export type MatchStatus = "ok" | "adjusted" | "no_product" | "no_offer";

export type MatchedLine = {
  raw: string;
  query: string;
  qty: number;
  status: MatchStatus;
  product?: { id: string; name: string; manufacturer?: string; packSizeLabel?: string };
  offer?: BestOffer;
};

/** Resolves pasted names to catalogue products: exact first, then "starts with". */
async function findProducts(names: string[]) {
  await connectDB();
  type Match = { _id: mongoose.Types.ObjectId; name: string; manufacturer?: string | null; packSizeLabel?: string | null };
  const byKey = new Map<string, Match>();
  const projection = { name: 1, manufacturer: 1, packSizeLabel: 1 };

  const exact = await Product.find({ name: { $in: names }, active: true }, projection).collation(NAME_COLLATION).lean();
  for (const p of exact) byKey.set(p.name.toLowerCase(), p);

  const missing = names.filter((n) => !byKey.has(n.toLowerCase())).slice(0, MAX_FUZZY_LOOKUPS);
  for (const name of missing) {
    const hit = await Product.findOne(
      { name: { $regex: `^${escapeRegExp(name)}`, $options: "i" }, active: true },
      projection,
    ).lean();
    if (hit) byKey.set(name.toLowerCase(), hit);
  }
  return byKey;
}

/** Matches a parsed purchase list to the cheapest available listing for each line. */
export async function matchPurchaseList(lines: ParsedLine[], buyerId: mongoose.Types.ObjectId): Promise<MatchedLine[]> {
  if (!lines.length) return [];
  const byKey = await findProducts(lines.map((l) => l.name));
  const offers = await bestOffers([...new Set([...byKey.values()].map((p) => p._id))], buyerId);

  return lines.map((line) => {
    const product = byKey.get(line.name.toLowerCase());
    if (!product) return { raw: line.raw, query: line.name, qty: line.qty, status: "no_product" as const };
    const offer = offers.get(String(product._id));
    const base = {
      raw: line.raw,
      query: line.name,
      product: {
        id: String(product._id),
        name: product.name,
        manufacturer: product.manufacturer ?? undefined,
        packSizeLabel: product.packSizeLabel ?? undefined,
      },
    };
    if (!offer) return { ...base, qty: line.qty, status: "no_offer" as const };
    // Respect the seller's minimum order quantity and what is actually in stock.
    const qty = Math.min(Math.max(line.qty, offer.minOrderQty), offer.stock);
    return { ...base, offer, qty, status: qty === line.qty ? ("ok" as const) : ("adjusted" as const) };
  });
}

/** "Buy again": the same products as a past order, at today's cheapest price. */
export async function reorderLines(orderId: string, buyerId: mongoose.Types.ObjectId): Promise<MatchedLine[] | null> {
  await connectDB();
  const order = await Order.findOne({ _id: orderId, buyerId }, { items: 1 }).lean();
  if (!order) return null;
  const wanted = new Map<string, { qty: number; name: string }>();
  for (const i of order.items) {
    const key = String(i.productId);
    wanted.set(key, { qty: (wanted.get(key)?.qty ?? 0) + i.qty, name: i.name });
  }
  const offers = await bestOffers([...wanted.keys()].map((id) => new mongoose.Types.ObjectId(id)), buyerId);

  return [...wanted.entries()].map(([productId, { qty, name }]) => {
    const offer = offers.get(productId);
    const base = { raw: name, query: name, product: { id: productId, name } };
    if (!offer) return { ...base, qty, status: "no_offer" as const };
    const adjusted = Math.min(Math.max(qty, offer.minOrderQty), offer.stock);
    return { ...base, offer, qty: adjusted, status: adjusted === qty ? ("ok" as const) : ("adjusted" as const) };
  });
}
