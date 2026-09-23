// Pack / loose-unit maths for a medical shop (no I/O) — unit tested in
// tests/retail-units.test.ts.
//
// Stock is held in the smallest sellable unit (a tablet, a capsule), because a
// chemist cuts strips all day: "5 tablets de do" out of a strip of 15. A batch
// that cannot be split — a syrup bottle, an injection, an ointment — simply has
// unitsPerPack = 1, and behaves exactly as it always did.

import { round2 } from "@/lib/orders/gst";

/** How a line was entered at the counter. */
export type SaleUnit = "pack" | "unit";

/** How the shop prices a single tablet cut from a strip. */
export type LooseRounding = "up" | "exact";

/** 176 units of a strip of 15 → 11 full strips and 11 loose. */
export function packsAndLoose(units: number, unitsPerPack: number) {
  const per = Math.max(Math.floor(unitsPerPack) || 1, 1);
  const total = Math.max(Math.floor(units) || 0, 0);
  return { packs: Math.floor(total / per), loose: total % per, unitsPerPack: per };
}

/** Whole packs, as a fraction — for stock value and ordering, where part-packs count. */
export function inPacks(units: number, unitsPerPack: number) {
  const per = Math.max(Math.floor(unitsPerPack) || 1, 1);
  return round2(Math.max(units, 0) / per);
}

/**
 * Price of one tablet. MRP is printed for the whole strip, so loose sales
 * divide it — and most shops round the paise up, which is part of how they
 * make their margin on a cut strip.
 */
export function unitPrice(mrp: number, unitsPerPack: number, rounding: LooseRounding = "up") {
  const per = Math.max(Math.floor(unitsPerPack) || 1, 1);
  if (per <= 1) return round2(mrp);
  const exact = mrp / per;
  return rounding === "exact" ? round2(exact) : Math.ceil(exact * 100) / 100;
}

/** What one line of a bill takes off the shelf. */
export function unitsSold(qty: number, saleUnit: SaleUnit, unitsPerPack: number) {
  const per = Math.max(Math.floor(unitsPerPack) || 1, 1);
  return Math.max(Math.floor(qty) || 0, 0) * (saleUnit === "pack" ? per : 1);
}

/** The rate to charge per whatever the operator typed. */
export function rateFor(opts: { mrp: number; saleUnit: SaleUnit; unitsPerPack: number; rounding?: LooseRounding }) {
  return opts.saleUnit === "pack" ? round2(opts.mrp) : unitPrice(opts.mrp, opts.unitsPerPack, opts.rounding);
}

/** Purchase cost of one unit, for the margin reports. */
export function unitCost(cost: number, unitsPerPack: number) {
  const per = Math.max(Math.floor(unitsPerPack) || 1, 1);
  return cost / per;
}

/** Can this batch be split at all? */
export const isDivisible = (unitsPerPack: number) => Math.floor(unitsPerPack) > 1;

const NUMBER_WORDS = /(\d+(?:\.\d+)?)/;

/**
 * Reads how many tablets are in a pack from the catalogue's free-text pack
 * label: "strip of 15", "15 tablets", "10's", "1 x 10". Returns null for
 * anything measured rather than counted (ml, gm), because those don't split.
 */
export function parsePackUnits(packSizeLabel?: string | null): number | null {
  const s = (packSizeLabel ?? "").toLowerCase().trim();
  if (!s) return null;
  // Volumes and weights are one indivisible pack: a 100 ml bottle, a 30 gm tube.
  if (/\b\d+\s*(ml|l|gm|g|kg|mg|mcg|iu)\b/.test(s) && !/\b(tab|cap)/.test(s)) return null;

  const patterns = [
    /(?:strip|pack|box|bottle|jar|packet)\s*of\s*(\d+)/, // "strip of 15"
    /\b\d+\s*[x×]\s*(\d+)/, // "1 x 10", "2x15"
    /(\d+)\s*(?:'s|s\b)/, // "10's"
    /(\d+)\s*(?:tablets?|tabs?|capsules?|caps?|pills?|sachets?)/, // "15 tablets"
  ];
  for (const re of patterns) {
    const m = re.exec(s);
    if (m) {
      const n = Number(m[1]);
      if (Number.isInteger(n) && n > 1 && n <= 1000) return n;
    }
  }
  // A bare number on a tablet/capsule label ("Tablet 15").
  if (/\b(tab|cap|pill|sachet)/.test(s)) {
    const m = NUMBER_WORDS.exec(s);
    const n = m ? Number(m[1]) : NaN;
    if (Number.isInteger(n) && n > 1 && n <= 1000) return n;
  }
  return null;
}
