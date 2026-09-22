import { describe, expect, it } from "vitest";
import { amountInWords, computeTotals, financialYear, hsnSummary, lineTax, round2 } from "@/lib/orders/gst";

describe("lineTax", () => {
  it("splits GST into CGST + SGST for intra-state supply", () => {
    const l = lineTax({ price: 24.5, qty: 10, gstRate: 5, hsn: "3004" }, false);
    expect(l).toEqual({ taxable: 245, cgst: 6.13, sgst: 6.12, igst: 0, total: 257.25 });
    expect(round2(l.cgst + l.sgst)).toBe(12.25);
  });

  it("charges IGST for inter-state supply", () => {
    expect(lineTax({ price: 24.5, qty: 10, gstRate: 5, hsn: "3004" }, true)).toEqual({
      taxable: 245,
      cgst: 0,
      sgst: 0,
      igst: 12.25,
      total: 257.25,
    });
  });

  it("handles 0% GST and fractional prices", () => {
    expect(lineTax({ price: 0.1, qty: 3, gstRate: 0, hsn: "3004" }, false).taxable).toBe(0.3);
    expect(lineTax({ price: 1.005, qty: 1, gstRate: 12, hsn: "3004" }, true).taxable).toBe(1.01);
  });
});

describe("computeTotals", () => {
  it("sums lines and rounds the grand total to the nearest rupee", () => {
    const lines = [
      lineTax({ price: 24.5, qty: 10, gstRate: 5, hsn: "3004" }, false),
      lineTax({ price: 96.37, qty: 3, gstRate: 12, hsn: "3004" }, false),
    ];
    const t = computeTotals(lines);
    expect(t.taxable).toBe(534.11);
    expect(t.tax).toBe(round2(t.cgst + t.sgst));
    expect(t.grandTotal).toBe(Math.round(t.taxable + t.tax));
    expect(round2(t.taxable + t.tax + t.roundOff)).toBe(t.grandTotal);
    expect(Math.abs(t.roundOff)).toBeLessThanOrEqual(0.5);
  });
});

describe("hsnSummary", () => {
  it("groups by HSN and rate", () => {
    const mk = (price: number, gstRate: number, hsn: string) => ({
      ...lineTax({ price, qty: 1, gstRate, hsn }, true),
      hsn,
      gstRate,
    });
    const rows = hsnSummary([mk(100, 5, "3004"), mk(50, 5, "3004"), mk(200, 12, "3004"), mk(10, 5, "3003")]);
    expect(rows).toEqual([
      { hsn: "3003", gstRate: 5, taxable: 10, cgst: 0, sgst: 0, igst: 0.5 },
      { hsn: "3004", gstRate: 5, taxable: 150, cgst: 0, sgst: 0, igst: 7.5 },
      { hsn: "3004", gstRate: 12, taxable: 200, cgst: 0, sgst: 0, igst: 24 },
    ]);
  });
});

describe("amountInWords", () => {
  it("uses the Indian numbering system", () => {
    expect(amountInWords(0)).toBe("Zero Rupees Only");
    expect(amountInWords(257)).toBe("Two Hundred Fifty Seven Rupees Only");
    expect(amountInWords(123456.5)).toBe(
      "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Fifty Paise Only",
    );
    expect(amountInWords(10_00_00_000)).toBe("Ten Crore Rupees Only");
    expect(amountInWords(1_01_011)).toBe("One Lakh One Thousand Eleven Rupees Only");
  });
});

describe("financialYear", () => {
  it("starts on 1 April", () => {
    expect(financialYear(new Date("2026-09-22"))).toBe("2026-27");
    expect(financialYear(new Date("2027-03-31"))).toBe("2026-27");
    expect(financialYear(new Date("2027-04-01"))).toBe("2027-28");
  });
});
