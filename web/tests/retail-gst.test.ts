import { describe, expect, it } from "vitest";
import { billLine, billTotals } from "@/lib/retail/gst";

describe("retail bill line", () => {
  it("works GST backwards out of the MRP", () => {
    // ₹105 MRP at 5% → ₹100 taxable + ₹5 GST, split evenly.
    expect(billLine({ qty: 2, mrp: 105, gstRate: 5 })).toEqual({
      gross: 210,
      discount: 0,
      total: 210,
      taxable: 200,
      cgst: 5,
      sgst: 5,
    });
  });

  it("taxes the discounted price, not the printed one", () => {
    const line = billLine({ qty: 1, mrp: 200, gstRate: 12, discountPercent: 10 });
    expect(line).toMatchObject({ gross: 200, discount: 20, total: 180 });
    expect(round(line.taxable + line.cgst + line.sgst)).toBe(180);
    expect(line.taxable).toBe(160.71);
  });

  it("never loses a paisa between CGST and SGST", () => {
    for (const mrp of [9.99, 33.33, 176.5, 1250.75]) {
      const l = billLine({ qty: 3, mrp, gstRate: 12 });
      expect(round(l.taxable + l.cgst + l.sgst)).toBe(l.total);
    }
  });

  it("ignores a nonsense discount", () => {
    expect(billLine({ qty: 1, mrp: 100, gstRate: 5, discountPercent: -5 }).discount).toBe(0);
    expect(billLine({ qty: 1, mrp: 100, gstRate: 5, discountPercent: 250 }).total).toBe(0);
  });
});

describe("bill totals", () => {
  const lines = [billLine({ qty: 2, mrp: 105, gstRate: 5 }), billLine({ qty: 1, mrp: 200, gstRate: 12, discountPercent: 10 })];

  it("adds up and rounds to the rupee", () => {
    const t = billTotals(lines);
    expect(t).toMatchObject({ gross: 410, discount: 20, grandTotal: 390 });
    expect(t.taxable + t.tax).toBeCloseTo(390, 2);
    expect(t.roundOff).toBe(0);
  });

  it("takes loyalty redemption off what is payable, not off the tax", () => {
    const t = billTotals(lines, 50);
    expect(t.redeemed).toBe(50);
    expect(t.grandTotal).toBe(340);
    expect(t.taxable).toBe(btTaxable(lines)); // unchanged by redemption
  });

  it("cannot redeem more than the bill", () => {
    expect(billTotals(lines, 9999)).toMatchObject({ redeemed: 390, grandTotal: 0 });
  });
});

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const btTaxable = (lines: ReturnType<typeof billLine>[]) => round(lines.reduce((a, l) => a + l.taxable, 0));
