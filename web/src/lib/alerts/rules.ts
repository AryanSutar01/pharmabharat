// Pure alert rules (no I/O) — unit tested in tests/alerts.test.ts.

export const PRICE_DIRECTIONS = ["drop", "rise", "any"] as const;
export type PriceDirection = (typeof PRICE_DIRECTIONS)[number];

/** Percentage change from `from` to `to`, one decimal. */
export function pctChange(from: number, to: number) {
  if (!(from > 0)) return 0;
  return Math.round(((to - from) / from) * 1000) / 10;
}

/**
 * Should a price alert fire?
 * `reference` is the price the user last saw (subscribe-time price, or the
 * price at the previous alert), so each move is reported once.
 */
export function shouldNotifyPrice(opts: {
  reference: number;
  current: number;
  direction: PriceDirection;
  thresholdPct: number;
}) {
  const { reference, current, direction, thresholdPct } = opts;
  if (!(reference > 0) || !(current > 0) || current === reference) return false;
  const change = pctChange(reference, current);
  const bigEnough = Math.abs(change) >= Math.max(thresholdPct, 0.1);
  if (!bigEnough) return false;
  if (direction === "drop") return change < 0;
  if (direction === "rise") return change > 0;
  return true;
}

/** Expiry warning levels, in days before expiry. Largest first. */
export const EXPIRY_LEVELS = [90, 60, 30] as const;
export type ExpiryLevel = (typeof EXPIRY_LEVELS)[number];

/**
 * Which expiry warning (if any) is due for a batch.
 * Returns the smallest level the batch has crossed that is tighter than the
 * last one already sent, so a batch found at 45 days gets one "60" alert,
 * then later one "30" alert — never duplicates.
 */
export function dueExpiryLevel(daysLeft: number, lastSent: ExpiryLevel | null | undefined): ExpiryLevel | null {
  if (daysLeft <= 0) return null; // already expired: shown on the inventory page, not alerted daily
  const crossed = EXPIRY_LEVELS.filter((l) => daysLeft <= l);
  if (!crossed.length) return null;
  const tightest = crossed[crossed.length - 1];
  if (lastSent && tightest >= lastSent) return null;
  return tightest;
}
