// Refill-cycle maths, learned from a customer's own purchase dates.
// No I/O — unit tested in tests/refill-cycle.test.ts.

const DAY = 24 * 3600 * 1000;

/** A cycle shorter than this is noise (two strips bought on consecutive days). */
const MIN_GAP_DAYS = 3;
/** Longer than this and it isn't a repeat medicine any more. */
const MAX_GAP_DAYS = 180;

/**
 * Typical number of days between purchases, as a median so one unusual gap
 * (a holiday, a hospital stay) doesn't move it. Null until the customer has
 * bought the same medicine at least twice.
 */
export function medianGap(dates: Date[]): number | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = (sorted[i].getTime() - sorted[i - 1].getTime()) / DAY;
    // Same-day or next-day repeats are one visit, not a refill cycle.
    if (days >= MIN_GAP_DAYS && days <= MAX_GAP_DAYS) gaps.push(days);
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return Math.round(gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2);
}

export type RefillCycle = {
  /** Days between purchases, or null if we can't tell yet. */
  gapDays: number | null;
  lastBoughtAt: Date;
  dueAt: Date | null;
  /** Negative until the due date, positive once overdue. */
  daysLate: number | null;
};

/** When this customer should next need the medicine. */
export function refillCycle(dates: Date[], now = new Date()): RefillCycle {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const lastBoughtAt = sorted[sorted.length - 1];
  const gapDays = medianGap(sorted);
  if (!gapDays) return { gapDays: null, lastBoughtAt, dueAt: null, daysLate: null };
  const dueAt = new Date(lastBoughtAt.getTime() + gapDays * DAY);
  return { gapDays, lastBoughtAt, dueAt, daysLate: Math.round((now.getTime() - dueAt.getTime()) / DAY) };
}

/**
 * Is this refill worth chasing today? Due within `lookAheadDays`, and not so
 * long overdue that the customer has clearly gone elsewhere or stopped.
 */
export function isDueForRefill(cycle: RefillCycle, lookAheadDays = 3, giveUpAfterDays = 30) {
  if (cycle.daysLate === null) return false;
  return cycle.daysLate >= -lookAheadDays && cycle.daysLate <= giveUpAfterDays;
}
