// Pure GST maths for a retail (shop → patient) bill. No I/O — unit tested in
// tests/retail-gst.test.ts.
//
// Retail differs from the B2B invoice in two ways:
// - The MRP printed on the pack is **inclusive of GST**, so tax is worked
//   backwards out of it: taxable = gross / (1 + rate/100). A tablet cut from a
//   strip is priced from that same MRP, so the same rule holds.
// - The customer is always in the shop's own state, so it is always CGST + SGST.
//
// A discount is given on the MRP, and the tax follows the discounted price —
// that is what the customer actually paid, and what the shop owes GST on.

import { round2 } from "@/lib/orders/gst";

export type BillLineInput = {
  qty: number;
  /**
   * Price of one of whatever was sold, including GST: the strip's MRP for a
   * whole strip, or the per-tablet price for a cut one (see lib/retail/units).
   */
  rate: number;
  gstRate: number;
  /** Percentage off the printed price for this line (0–100). */
  discountPercent?: number;
};

export type BillLineTax = {
  gross: number;
  discount: number;
  /** What the customer pays for this line, GST included. */
  total: number;
  taxable: number;
  cgst: number;
  sgst: number;
};

export type BillTotals = {
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  tax: number;
  /** Loyalty points turned into rupees off the bill. */
  redeemed: number;
  roundOff: number;
  grandTotal: number;
};

export function billLine(line: BillLineInput): BillLineTax {
  const gross = round2(line.rate * line.qty);
  const percent = Math.min(Math.max(line.discountPercent ?? 0, 0), 100);
  const discount = round2((gross * percent) / 100);
  const total = round2(gross - discount);
  // MRP includes GST, so strip it back out.
  const taxable = round2(total / (1 + line.gstRate / 100));
  const gst = round2(total - taxable);
  const cgst = round2(gst / 2);
  return { gross, discount, total, taxable, cgst, sgst: round2(gst - cgst) };
}

/**
 * Bill totals. `redeemed` is a rupee amount paid with loyalty points; it comes
 * off the amount payable, not off the taxable value — the sale still happened
 * at its full price, the shop just funded part of it.
 */
export function billTotals(lines: BillLineTax[], redeemed = 0): BillTotals {
  const sum = (k: keyof BillLineTax) => round2(lines.reduce((a, l) => a + l[k], 0));
  const cgst = sum("cgst");
  const sgst = sum("sgst");
  const total = sum("total");
  const capped = round2(Math.min(Math.max(redeemed, 0), total));
  const exact = round2(total - capped);
  const grandTotal = Math.round(exact);
  return {
    gross: sum("gross"),
    discount: sum("discount"),
    taxable: sum("taxable"),
    cgst,
    sgst,
    tax: round2(cgst + sgst),
    redeemed: capped,
    roundOff: round2(grandTotal - exact),
    grandTotal,
  };
}
