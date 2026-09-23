import "server-only";
import type mongoose from "mongoose";
import { sellableFilter } from "@/lib/catalog/queries";
import { connectDB } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { Listing } from "@/lib/models/listing";
import { Product } from "@/lib/models/product";
import { cheapestSwaps, type Alternative, type Swap } from "@/lib/orders/optimise";

export type CartSavings = {
  swaps: (Swap & { productName: string })[];
  totalSaving: number;
  sellersBefore: number;
  sellersAfter: number;
};

/**
 * Looks for a cheaper seller for everything in the cart. Only verified
 * sellers with enough stock are considered, and the buyer's own listings
 * are never suggested.
 */
export async function cartSavings(businessId: mongoose.Types.ObjectId, userId: string): Promise<CartSavings | null> {
  await connectDB();
  const cart = await Cart.findOne({ businessId, userId }, { items: 1 }).lean();
  if (!cart?.items.length) return null;

  const current = await Listing.find(
    { _id: { $in: cart.items.map((i) => i.listingId) } },
    { productId: 1, sellerId: 1, price: 1 },
  ).lean();
  if (!current.length) return null;
  const qtyByListing = new Map(cart.items.map((i) => [String(i.listingId), i.qty]));

  const productIds = [...new Set(current.map((l) => String(l.productId)))];
  const candidates = await Listing.find(
    { productId: { $in: current.map((l) => l.productId) }, sellerId: { $ne: businessId }, ...sellableFilter() },
    { productId: 1, sellerId: 1, price: 1, stock: 1, minOrderQty: 1 },
  )
    .sort({ price: 1 })
    .limit(500)
    .lean();
  if (!candidates.length) return null;

  const sellers = await Business.find(
    { _id: { $in: [...new Set(candidates.map((c) => String(c.sellerId)))] }, "kyc.status": "approved" },
    { legalName: 1, tradeName: 1 },
  ).lean();
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));

  const alternatives: Alternative[] = candidates
    .filter((c) => sellerById.has(String(c.sellerId)))
    .map((c) => ({
      listingId: String(c._id),
      productId: String(c.productId),
      sellerId: String(c.sellerId),
      sellerName: sellerById.get(String(c.sellerId))!.tradeName || sellerById.get(String(c.sellerId))!.legalName,
      price: c.price,
      stock: c.stock,
      minOrderQty: c.minOrderQty ?? 1,
    }));

  const result = cheapestSwaps(
    current.map((l) => ({
      listingId: String(l._id),
      productId: String(l.productId),
      sellerId: String(l.sellerId),
      qty: qtyByListing.get(String(l._id)) ?? 0,
      price: l.price,
    })),
    alternatives,
  );
  if (!result.swaps.length) return null;

  const products = await Product.find({ _id: { $in: productIds } }, { name: 1 }).lean();
  const nameById = new Map(products.map((p) => [String(p._id), p.name]));
  return {
    ...result,
    swaps: result.swaps.map((s) => ({ ...s, productName: nameById.get(s.productId) ?? "" })),
  };
}

/** Applies the swaps that are still valid, and reports how many were used. */
export async function applySavings(businessId: mongoose.Types.ObjectId, userId: string) {
  const savings = await cartSavings(businessId, userId);
  if (!savings) return { applied: 0, saved: 0 };

  const cart = await Cart.findOne({ businessId, userId }, { items: 1 }).lean();
  if (!cart) return { applied: 0, saved: 0 };

  // Two batches of the same product can land on the same listing, so merge.
  const byFrom = new Map(savings.swaps.map((s) => [s.from, s]));
  const merged = new Map<string, number>();
  for (const i of cart.items) {
    const target = byFrom.get(String(i.listingId))?.to ?? String(i.listingId);
    merged.set(target, (merged.get(target) ?? 0) + i.qty);
  }
  await Cart.updateOne(
    { _id: cart._id },
    { $set: { items: [...merged].map(([listingId, qty]) => ({ listingId, qty })) } },
  );
  return { applied: savings.swaps.length, saved: savings.totalSaving };
}
