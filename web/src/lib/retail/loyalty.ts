// Loyalty maths (no I/O) — unit tested in tests/loyalty.test.ts.
//
// Points are earned per rupee spent and redeemed as money off a later bill.
// Both rates, the minimum redemption and how long points last are the shop's
// choice (see ShopSettings).

import { round2 } from "@/lib/orders/gst";

export type LoyaltyRules = {
  active: boolean;
  /** Points earned per ₹100 spent. */
  pointsPerHundred: number;
  /** Rupees one point is worth when redeemed. */
  pointValue: number;
  minRedeemPoints: number;
  expiryMonths: number;
};

/** Whole points earned on a bill. Part-hundreds don't earn — shops round down. */
export function pointsForSpend(amount: number, rules: LoyaltyRules) {
  if (!rules.active || rules.pointsPerHundred <= 0 || amount <= 0) return 0;
  return Math.floor((amount / 100) * rules.pointsPerHundred);
}

export type RedeemPlan = { points: number; value: number; reason?: "inactive" | "below_minimum" | "no_points" };

/**
 * How much of a balance can be used on this bill. Never more than the bill
 * itself, and only in whole points.
 */
export function redeemPlan(opts: { balance: number; billTotal: number; wantPoints?: number; rules: LoyaltyRules }): RedeemPlan {
  const { balance, billTotal, rules } = opts;
  if (!rules.active || rules.pointValue <= 0) return { points: 0, value: 0, reason: "inactive" };
  if (balance <= 0) return { points: 0, value: 0, reason: "no_points" };
  if (balance < rules.minRedeemPoints) return { points: 0, value: 0, reason: "below_minimum" };

  const wanted = opts.wantPoints === undefined ? balance : Math.max(Math.floor(opts.wantPoints), 0);
  const affordable = Math.floor(billTotal / rules.pointValue);
  const points = Math.min(balance, wanted, affordable);
  if (points < rules.minRedeemPoints) return { points: 0, value: 0, reason: "below_minimum" };
  return { points, value: round2(points * rules.pointValue) };
}

export type LedgerEntry = {
  id: string;
  points: number;
  createdAt: Date;
  expiresAt?: Date | null;
};

/**
 * Walks the ledger oldest first, spending redemptions against the oldest
 * points (FIFO), then reports what is left over from batches that have since
 * lapsed. The caller writes that as an "expired" entry.
 */
export function expiredPoints(entries: LedgerEntry[], now = new Date()) {
  const ordered = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const earned: { points: number; expiresAt: Date | null }[] = [];
  let spent = 0;

  for (const e of ordered) {
    if (e.points > 0) earned.push({ points: e.points, expiresAt: e.expiresAt ?? null });
    else spent += -e.points;
  }
  // Consume the oldest batches first.
  for (const batch of earned) {
    if (spent <= 0) break;
    const used = Math.min(batch.points, spent);
    batch.points -= used;
    spent -= used;
  }
  const expired = earned
    .filter((b) => b.points > 0 && b.expiresAt && b.expiresAt.getTime() <= now.getTime())
    .reduce((a, b) => a + b.points, 0);
  const balance = earned.reduce((a, b) => a + b.points, 0);
  return { expired, balance, remaining: balance - expired };
}

/** When points earned today lapse. */
export function pointsExpiryDate(rules: LoyaltyRules, from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + Math.max(rules.expiryMonths, 1));
  return d;
}
