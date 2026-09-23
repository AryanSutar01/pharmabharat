// Parses a pasted purchase list (no I/O) — unit tested in tests/quick-list.test.ts.

export const MAX_QUICK_LINES = 200;

export type ParsedLine = {
  /** The line as typed, for showing next to the match. */
  raw: string;
  /** What to search the catalogue for. */
  name: string;
  qty: number;
};

/** A header row names both a product column and a quantity column. */
const HEADER =
  /^(?=.*\b(product|item|medicine|name|description)\b)(?=.*\b(qty|quantity|nos|units|packs?|strips?|rate|amount)\b)/i;
/** "12", "12 nos", "12 pcs", "x12", "qty 12", "12 strips" */
const QTY_TAIL = /(?:[x*×]\s*)?(\d{1,5})\s*(?:nos?|pcs?|pieces?|units?|strips?|boxes|box|packs?|qty)?\.?$/i;
const LEADING_SERIAL = /^\s*\d{1,3}\s*[.)\]-]\s+/;
const SEPARATORS = /[,;|\t]|\s{2,}|\s+[-–—x*×]\s+/;

function cleanName(s: string) {
  return s
    .replace(LEADING_SERIAL, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toQty(s: string | undefined) {
  const n = Number((s ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100_000) : 0;
}

/**
 * Turns pasted text into name + quantity pairs. Accepts the shapes a
 * chemist actually pastes: CSV, tab-separated, "Dolo 650 x 10",
 * "1. Dolo 650 - 10 strips", or just a bare product name (qty 1).
 * Repeated products are merged.
 */
export function parsePurchaseList(text: string): ParsedLine[] {
  const merged = new Map<string, ParsedLine>();

  for (const rawLine of text.split(/\r?\n/).slice(0, MAX_QUICK_LINES * 2)) {
    const raw = rawLine.trim();
    if (!raw || HEADER.test(raw)) continue;

    // Split off the last field; if it is a number treat it as the quantity.
    const parts = raw.split(SEPARATORS).map((s) => s.trim()).filter(Boolean);
    let name = cleanName(parts.join(" "));
    let qty = 0;

    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      qty = toQty(QTY_TAIL.exec(last)?.[1]);
      if (qty) name = cleanName(parts.slice(0, -1).join(" "));
    }
    if (!qty) {
      // "Dolo 650 x 10" with no separator, or a trailing bare number.
      const m = /(?:[x*×]\s*(\d{1,5})|\s(\d{1,5})\s*(?:nos?|pcs?|pieces?|units?|strips?|boxes|box|packs?))\s*$/i.exec(name);
      if (m) {
        qty = toQty(m[1] ?? m[2]);
        name = cleanName(name.slice(0, m.index));
      }
    }
    if (!name) continue;

    const key = name.toLowerCase();
    const existing = merged.get(key);
    if (existing) existing.qty += qty || 1;
    else merged.set(key, { raw, name, qty: qty || 1 });
    if (merged.size >= MAX_QUICK_LINES) break;
  }

  return [...merged.values()];
}
