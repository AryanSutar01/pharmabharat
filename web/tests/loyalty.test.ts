import { describe, expect, it } from "vitest";
import { expiredPoints, pointsExpiryDate, pointsForSpend, redeemPlan, type LoyaltyRules } from "@/lib/retail/loyalty";

const rules: LoyaltyRules = { active: true, pointsPerHundred: 1, pointValue: 1, minRedeemPoints: 100, expiryMonths: 12 };
const at = (s: string) => new Date(`2026-${s}T10:00:00Z`);

describe("pointsForSpend", () => {
  it("earns whole points per hundred rupees, rounding down", () => {
    expect(pointsForSpend(450, rules)).toBe(4);
    expect(pointsForSpend(99, rules)).toBe(0);
    expect(pointsForSpend(1000, { ...rules, pointsPerHundred: 2 })).toBe(20);
  });

  it("earns nothing when the scheme is off", () => {
    expect(pointsForSpend(5000, { ...rules, active: false })).toBe(0);
    expect(pointsForSpend(5000, { ...rules, pointsPerHundred: 0 })).toBe(0);
  });
});

describe("redeemPlan", () => {
  it("turns points into money off, capped by the bill", () => {
    expect(redeemPlan({ balance: 500, billTotal: 900, rules })).toEqual({ points: 500, value: 500 });
    expect(redeemPlan({ balance: 500, billTotal: 320, rules })).toEqual({ points: 320, value: 320 });
  });

  it("respects the shop's minimum", () => {
    expect(redeemPlan({ balance: 80, billTotal: 900, rules })).toMatchObject({ points: 0, reason: "below_minimum" });
    // Asking for less than the minimum is refused too.
    expect(redeemPlan({ balance: 500, billTotal: 900, wantPoints: 50, rules })).toMatchObject({ reason: "below_minimum" });
  });

  it("honours a partial redemption", () => {
    expect(redeemPlan({ balance: 500, billTotal: 900, wantPoints: 200, rules })).toEqual({ points: 200, value: 200 });
  });

  it("uses the shop's point value", () => {
    const rich = { ...rules, pointValue: 0.5, minRedeemPoints: 100 };
    expect(redeemPlan({ balance: 500, billTotal: 900, rules: rich })).toEqual({ points: 500, value: 250 });
    // A ₹120 bill can only absorb 240 points at 50 paise each.
    expect(redeemPlan({ balance: 500, billTotal: 120, rules: rich })).toEqual({ points: 240, value: 120 });
  });

  it("says nothing to redeem when the scheme is off or the balance is empty", () => {
    expect(redeemPlan({ balance: 500, billTotal: 900, rules: { ...rules, active: false } })).toMatchObject({ reason: "inactive" });
    expect(redeemPlan({ balance: 0, billTotal: 900, rules })).toMatchObject({ reason: "no_points" });
  });
});

describe("expiredPoints", () => {
  const entry = (id: string, points: number, createdAt: string, expires?: string) => ({
    id,
    points,
    createdAt: at(createdAt),
    expiresAt: expires ? at(expires) : null,
  });

  it("spends the oldest points first, so newer ones survive", () => {
    const ledger = [
      entry("a", 100, "01-01", "02-01"), // would lapse in February
      entry("b", 150, "01-20", "12-01"),
      entry("c", -120, "01-25"), // redeemed: eats all of a, then 20 of b
    ];
    expect(expiredPoints(ledger, at("03-01"))).toEqual({ expired: 0, balance: 130, remaining: 130 });
  });

  it("expires what is left in a lapsed batch", () => {
    const ledger = [entry("a", 100, "01-01", "02-01"), entry("b", 50, "01-20", "12-01"), entry("c", -40, "01-25")];
    // 40 spent from batch a, 60 left there and now lapsed.
    expect(expiredPoints(ledger, at("03-01"))).toEqual({ expired: 60, balance: 110, remaining: 50 });
  });

  it("expires nothing before the date", () => {
    const ledger = [entry("a", 100, "01-01", "12-01")];
    expect(expiredPoints(ledger, at("03-01"))).toMatchObject({ expired: 0, balance: 100 });
  });
});

describe("pointsExpiryDate", () => {
  it("counts forward by the shop's months", () => {
    expect(pointsExpiryDate(rules, at("01-15")).toISOString().slice(0, 10)).toBe("2027-01-15");
    expect(pointsExpiryDate({ ...rules, expiryMonths: 6 }, at("01-15")).toISOString().slice(0, 10)).toBe("2026-07-15");
  });
});
