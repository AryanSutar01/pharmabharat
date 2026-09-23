// Cart optimiser maths (no I/O) — unit tested in tests/optimise.test.ts.

import { round2 } from "@/lib/orders/gst";

export type CartCandidate = {
  listingId: string;
  productId: string;
  sellerId: string;
  qty: number;
  price: number;
};

export type Alternative = {
  listingId: string;
  productId: string;
  sellerId: string;
  sellerName: string;
  price: number;
  stock: number;
  minOrderQty: number;
};

export type Swap = {
  from: string;
  to: string;
  productId: string;
  qty: number;
  oldPrice: number;
  newPrice: number;
  saving: number;
  sellerId: string;
  sellerName: string;
};

/** Ignore savings smaller than a rupee — not worth another delivery. */
const MIN_SAVING = 1;

/**
 * For every cart line, the cheapest listing of the same product that can
 * actually fulfil the quantity. Ties go to a seller already in the cart, so
 * the buyer doesn't end up with an extra delivery for nothing.
 */
export function cheapestSwaps(lines: CartCandidate[], alternatives: Alternative[]) {
  const byProduct = new Map<string, Alternative[]>();
  for (const a of alternatives) byProduct.set(a.productId, [...(byProduct.get(a.productId) ?? []), a]);
  const sellersInCart = new Set(lines.map((l) => l.sellerId));

  const swaps: Swap[] = [];
  for (const line of lines) {
    const options = (byProduct.get(line.productId) ?? []).filter(
      (a) => a.listingId !== line.listingId && a.stock >= line.qty && (a.minOrderQty ?? 1) <= line.qty,
    );
    if (!options.length) continue;

    const best = options.reduce((a, b) => {
      if (round2(a.price) !== round2(b.price)) return a.price < b.price ? a : b;
      const aKnown = sellersInCart.has(a.sellerId);
      const bKnown = sellersInCart.has(b.sellerId);
      return aKnown && !bKnown ? a : !aKnown && bKnown ? b : a;
    });

    const saving = round2((line.price - best.price) * line.qty);
    if (saving < MIN_SAVING) continue;
    swaps.push({
      from: line.listingId,
      to: best.listingId,
      productId: line.productId,
      qty: line.qty,
      oldPrice: line.price,
      newPrice: best.price,
      saving,
      sellerId: best.sellerId,
      sellerName: best.sellerName,
    });
  }

  const sellersAfter = new Set(
    lines.map((l) => swaps.find((s) => s.from === l.listingId)?.sellerId ?? l.sellerId),
  );
  return {
    swaps,
    totalSaving: round2(swaps.reduce((a, s) => a + s.saving, 0)),
    sellersBefore: sellersInCart.size,
    sellersAfter: sellersAfter.size,
  };
}
