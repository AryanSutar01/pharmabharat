// Pure GST maths for orders and invoices. No I/O — unit tested in tests/gst.test.ts.
//
// Rules applied (CGST Act / IGST Act, B2B supply of goods):
// - Seller and buyer in the same state  → CGST + SGST, each half the rate.
// - Different states                    → IGST at the full rate.
// - Tax is computed per line on the taxable value (price excl. GST × qty),
//   rounded to paise; the invoice total is rounded to the nearest rupee and
//   the difference shown as "round off".

export type LineInput = { price: number; qty: number; gstRate: number; hsn: string };

export type LineTax = {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

export type Totals = {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  roundOff: number;
  grandTotal: number;
};

export type HsnRow = { hsn: string; gstRate: number; taxable: number; cgst: number; sgst: number; igst: number };

/** Round to 2 decimals without binary floating point drift (1.005 → 1.01). */
export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineTax(line: LineInput, interState: boolean): LineTax {
  const taxable = round2(line.price * line.qty);
  const gst = round2((taxable * line.gstRate) / 100);
  if (interState) return { taxable, cgst: 0, sgst: 0, igst: gst, total: round2(taxable + gst) };
  const cgst = round2(gst / 2);
  const sgst = round2(gst - cgst); // keeps cgst + sgst === gst exactly
  return { taxable, cgst, sgst, igst: 0, total: round2(taxable + gst) };
}

export function computeTotals(lines: LineTax[]): Totals {
  const sum = (k: keyof LineTax) => round2(lines.reduce((a, l) => a + l[k], 0));
  const taxable = sum("taxable");
  const cgst = sum("cgst");
  const sgst = sum("sgst");
  const igst = sum("igst");
  const tax = round2(cgst + sgst + igst);
  const exact = round2(taxable + tax);
  const grandTotal = Math.round(exact);
  return { taxable, cgst, sgst, igst, tax, roundOff: round2(grandTotal - exact), grandTotal };
}

/** HSN-wise summary required on tax invoices. */
export function hsnSummary(lines: (LineTax & { hsn: string; gstRate: number })[]): HsnRow[] {
  const map = new Map<string, HsnRow>();
  for (const l of lines) {
    const key = `${l.hsn}|${l.gstRate}`;
    const row = map.get(key) ?? { hsn: l.hsn, gstRate: l.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable = round2(row.taxable + l.taxable);
    row.cgst = round2(row.cgst + l.cgst);
    row.sgst = round2(row.sgst + l.sgst);
    row.igst = round2(row.igst + l.igst);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || a.gstRate - b.gstRate);
}

// ------------------------------------------------------------ amount in words

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/** 123456.5 → "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Fifty Paise Only" */
export function amountInWords(amount: number) {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;
  if (crore) parts.push(`${crore >= 1000 ? amountInWords(crore).replace(/ Rupees.*$/, "") : belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  const words = parts.join(" ") || "Zero";
  return `${words} Rupees${paise ? ` and ${belowHundred(paise)} Paise` : ""} Only`;
}

/** Indian financial year label for a date: 2026-09-22 → "2026-27". */
export function financialYear(d: Date) {
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}
