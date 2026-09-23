import { describe, expect, it } from "vitest";
import { cheapestSwaps, type Alternative, type CartCandidate } from "@/lib/orders/optimise";

const line = (listingId: string, productId: string, sellerId: string, qty: number, price: number): CartCandidate => ({
  listingId,
  productId,
  sellerId,
  qty,
  price,
});

const alt = (
  listingId: string,
  productId: string,
  sellerId: string,
  price: number,
  stock = 100,
  minOrderQty = 1,
): Alternative => ({ listingId, productId, sellerId, sellerName: `Seller ${sellerId}`, price, stock, minOrderQty });

describe("cheapestSwaps", () => {
  it("swaps to the cheapest seller and totals the saving", () => {
    const result = cheapestSwaps(
      [line("L1", "P1", "S1", 10, 100), line("L2", "P2", "S1", 5, 60)],
      [alt("L3", "P1", "S2", 92), alt("L4", "P1", "S3", 95), alt("L5", "P2", "S2", 58)],
    );
    expect(result.swaps.map((s) => [s.from, s.to, s.saving])).toEqual([
      ["L1", "L3", 80],
      ["L2", "L5", 10],
    ]);
    expect(result.totalSaving).toBe(90);
    expect(result).toMatchObject({ sellersBefore: 1, sellersAfter: 1 });
  });

  it("skips alternatives that cannot fulfil the line", () => {
    const result = cheapestSwaps(
      [line("L1", "P1", "S1", 10, 100)],
      [alt("L2", "P1", "S2", 50, 4), alt("L3", "P1", "S3", 60, 100, 20)],
    );
    expect(result.swaps).toEqual([]);
    expect(result.totalSaving).toBe(0);
  });

  it("ignores savings under a rupee", () => {
    expect(cheapestSwaps([line("L1", "P1", "S1", 2, 50)], [alt("L2", "P1", "S2", 49.7)]).swaps).toEqual([]);
  });

  it("prefers a seller already in the cart when prices tie", () => {
    const result = cheapestSwaps(
      [line("L1", "P1", "S1", 10, 100), line("L9", "P9", "S2", 1, 10)],
      [alt("L2", "P1", "S3", 90), alt("L3", "P1", "S2", 90)],
    );
    expect(result.swaps[0].sellerId).toBe("S2");
    // Both lines now come from S2, so the order needs one delivery instead of two.
    expect(result).toMatchObject({ sellersBefore: 2, sellersAfter: 1 });
  });

  it("counts how many sellers the order ends up with", () => {
    const result = cheapestSwaps([line("L1", "P1", "S1", 10, 100)], [alt("L2", "P1", "S2", 80)]);
    expect(result).toMatchObject({ sellersBefore: 1, sellersAfter: 1 });
    expect(result.swaps[0].sellerName).toBe("Seller S2");
  });
});
