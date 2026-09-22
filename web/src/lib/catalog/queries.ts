import "server-only";
import mongoose, { type PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { Condition } from "@/lib/models/condition";
import { Listing } from "@/lib/models/listing";
import { Product, type ProductDoc } from "@/lib/models/product";
import { PRODUCT_SEARCH_INDEX } from "@/lib/catalog/search-index";
import { marginPercent } from "@/lib/catalog/normalize";

/** Listings a buyer may see: active, in stock, and not expiring within 30 days. */
export function sellableFilter(now = new Date()) {
  return {
    status: "active" as const,
    stock: { $gt: 0 },
    expiryDate: { $gt: new Date(now.getTime() + 30 * 24 * 3600 * 1000) },
  };
}

export type OfferSummary = { bestPrice: number; bestMargin: number; sellers: number };

export type ProductHit = Pick<
  ProductDoc,
  "name" | "manufacturer" | "form" | "packSizeLabel" | "mrp" | "ingredients" | "conditions"
> & { id: string; offers: OfferSummary | null };

const PAGE_SIZE = 20;

/**
 * Catalog search. Free text goes through Atlas Search (typo-tolerant, prefix
 * matching on brand and salt names); a condition alone is a plain indexed find.
 */
export async function searchProducts(opts: { q?: string; condition?: string; page?: number }) {
  await connectDB();
  const q = opts.q?.trim().slice(0, 80) ?? "";
  const page = Math.max(1, opts.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  let docs: (ProductDoc & { _id: mongoose.Types.ObjectId })[];
  if (q) {
    const filter: Record<string, unknown>[] = [{ equals: { path: "active", value: true } }];
    if (opts.condition) filter.push({ equals: { path: "conditions", value: opts.condition } });
    const pipeline: PipelineStage[] = [
      {
        $search: {
          index: PRODUCT_SEARCH_INDEX,
          compound: {
            filter,
            should: [
              { autocomplete: { query: q, path: "name", fuzzy: { maxEdits: 1, prefixLength: 1 }, score: { boost: { value: 4 } } } },
              { text: { query: q, path: "name", fuzzy: { maxEdits: 2, prefixLength: 1 }, score: { boost: { value: 2 } } } },
              { autocomplete: { query: q, path: "salts", fuzzy: { maxEdits: 1, prefixLength: 2 }, score: { boost: { value: 2 } } } },
              { text: { query: q, path: "manufacturer", fuzzy: { maxEdits: 1 } } },
            ],
            minimumShouldMatch: 1,
          },
        },
      },
      { $skip: skip },
      { $limit: PAGE_SIZE },
    ];
    docs = await Product.aggregate(pipeline);
  } else if (opts.condition) {
    docs = await Product.find({ conditions: opts.condition, active: true })
      .sort({ _id: 1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .lean();
  } else {
    docs = [];
  }

  const offers = await offerSummaries(docs.map((d) => d._id));
  const hits: ProductHit[] = docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    manufacturer: d.manufacturer,
    form: d.form,
    packSizeLabel: d.packSizeLabel,
    mrp: d.mrp,
    ingredients: d.ingredients,
    conditions: d.conditions,
    offers: offers.get(String(d._id)) ?? null,
  }));
  return { hits, page, hasMore: docs.length === PAGE_SIZE };
}

/** Best price / margin / seller count per product, from sellable listings. */
export async function offerSummaries(productIds: mongoose.Types.ObjectId[]) {
  if (!productIds.length) return new Map<string, OfferSummary>();
  const rows = await Listing.aggregate<{ _id: mongoose.Types.ObjectId; bestPrice: number; mrp: number; sellers: number }>([
    { $match: { productId: { $in: productIds }, ...sellableFilter() } },
    { $sort: { price: 1 } },
    {
      $group: {
        _id: "$productId",
        bestPrice: { $first: "$price" },
        mrp: { $first: "$mrp" },
        sellers: { $addToSet: "$sellerId" },
      },
    },
    { $project: { bestPrice: 1, mrp: 1, sellers: { $size: "$sellers" } } },
  ]);
  return new Map(
    rows.map((r) => [
      String(r._id),
      { bestPrice: r.bestPrice, bestMargin: marginPercent(r.mrp, r.bestPrice), sellers: r.sellers },
    ]),
  );
}

export type Offer = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerCity: string;
  sellerStateCode: string;
  batchNo: string;
  expiryDate: Date;
  mrp: number;
  price: number;
  margin: number;
  gstRate: number;
  stock: number;
  minOrderQty: number;
  storage: string;
};

export async function getProductWithOffers(productId: string) {
  if (!mongoose.isValidObjectId(productId)) return null;
  await connectDB();
  const product = await Product.findById(productId).lean();
  if (!product) return null;

  const listings = await Listing.find({ productId: product._id, ...sellableFilter() }).sort({ price: 1 }).limit(50).lean();
  const sellers = await Business.find(
    { _id: { $in: listings.map((l) => l.sellerId) }, "kyc.status": "approved" },
    { legalName: 1, tradeName: 1, address: 1 },
  ).lean();
  const byId = new Map(sellers.map((s) => [String(s._id), s]));

  const offers: Offer[] = listings
    .filter((l) => byId.has(String(l.sellerId)))
    .map((l) => {
      const s = byId.get(String(l.sellerId))!;
      return {
        id: String(l._id),
        sellerId: String(l.sellerId),
        sellerName: s.tradeName || s.legalName,
        sellerCity: s.address?.city ?? "",
        sellerStateCode: s.address?.stateCode ?? "",
        batchNo: l.batchNo,
        expiryDate: l.expiryDate,
        mrp: l.mrp,
        price: l.price,
        margin: marginPercent(l.mrp, l.price),
        gstRate: l.gstRate,
        stock: l.stock,
        minOrderQty: l.minOrderQty ?? 1,
        storage: l.storage ?? "room",
      };
    });

  return { product, offers };
}

/** Same salts and strengths, different brand/pack. Cheapest offer first. */
export async function getSubstitutes(product: ProductDoc & { _id: mongoose.Types.ObjectId }, limit = 12) {
  if (!product.compositionKey) return [];
  await connectDB();
  const docs = await Product.find({ compositionKey: product.compositionKey, active: true, _id: { $ne: product._id } })
    .limit(200)
    .lean();
  const offers = await offerSummaries(docs.map((d) => d._id));
  return docs
    .map((d) => ({
      id: String(d._id),
      name: d.name,
      manufacturer: d.manufacturer,
      packSizeLabel: d.packSizeLabel,
      mrp: d.mrp,
      offers: offers.get(String(d._id)) ?? null,
    }))
    .sort((a, b) => {
      // Products with sellers first (cheapest), then by MRP.
      if (a.offers && b.offers) return a.offers.bestPrice - b.offers.bestPrice;
      if (a.offers) return -1;
      if (b.offers) return 1;
      return (a.mrp ?? 0) - (b.mrp ?? 0);
    })
    .slice(0, limit);
}

/** Active condition tags with the label in the requested language (English fallback). */
export async function listConditions(locale: string) {
  await connectDB();
  const rows = await Condition.find({ active: true }, { slug: 1, name: 1 }).sort({ slug: 1 }).lean();
  return rows.map((c) => {
    const names = (c.name ?? {}) as Partial<Record<string, string>>;
    return { slug: c.slug, label: names[locale] || names.en || c.slug };
  });
}

/** Lightweight typeahead for the listing form. */
export async function suggestProducts(q: string, limit = 8) {
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  await connectDB();
  const docs = await Product.aggregate<ProductDoc & { _id: mongoose.Types.ObjectId }>([
    {
      $search: {
        index: PRODUCT_SEARCH_INDEX,
        compound: {
          filter: [{ equals: { path: "active", value: true } }],
          should: [
            { autocomplete: { query: term, path: "name", fuzzy: { maxEdits: 1, prefixLength: 1 } } },
            { autocomplete: { query: term, path: "salts", fuzzy: { maxEdits: 1, prefixLength: 2 } } },
          ],
          minimumShouldMatch: 1,
        },
      },
    },
    { $limit: limit },
    { $project: { name: 1, manufacturer: 1, packSizeLabel: 1, mrp: 1, hsn: 1, gstRate: 1 } },
  ]);
  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    manufacturer: d.manufacturer,
    packSizeLabel: d.packSizeLabel ?? "",
    mrp: d.mrp ?? 0,
    hsn: d.hsn ?? "3004",
    gstRate: d.gstRate ?? 5,
  }));
}
