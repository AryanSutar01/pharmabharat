import { describe, expect, it } from "vitest";
import { isDueForRefill, medianGap, refillCycle } from "@/lib/retail/cycle";

const d = (s: string) => new Date(`2026-${s}T10:00:00Z`);

describe("medianGap", () => {
  it("learns a monthly cycle from repeat purchases", () => {
    expect(medianGap([d("01-05"), d("02-02"), d("03-03"), d("03-31")])).toBe(28);
  });

  it("is not thrown off by one long gap", () => {
    // 28, 28, 90, 28 → median stays 28.
    expect(medianGap([d("01-01"), d("01-29"), d("02-26"), d("05-27"), d("06-24")])).toBe(28);
  });

  it("needs two purchases before it says anything", () => {
    expect(medianGap([d("01-05")])).toBeNull();
    expect(medianGap([])).toBeNull();
  });

  it("ignores same-day and next-day repeats", () => {
    expect(medianGap([d("01-05"), d("01-05"), d("01-06")])).toBeNull();
  });

  it("ignores gaps too long to be a refill", () => {
    expect(medianGap([d("01-01"), d("12-01")])).toBeNull();
  });
});

describe("refillCycle", () => {
  const dates = [d("01-01"), d("01-29"), d("02-26")];

  it("puts the next refill one cycle after the last purchase", () => {
    const cycle = refillCycle(dates, d("03-01"));
    expect(cycle.gapDays).toBe(28);
    expect(cycle.dueAt?.toISOString().slice(0, 10)).toBe("2026-03-26");
    expect(cycle.daysLate).toBe(-25);
  });

  it("counts how late a refill is", () => {
    expect(refillCycle(dates, d("04-05")).daysLate).toBe(10);
  });

  it("says nothing for a one-off purchase", () => {
    expect(refillCycle([d("02-26")], d("04-05"))).toMatchObject({ gapDays: null, dueAt: null, daysLate: null });
  });
});

describe("isDueForRefill", () => {
  const dates = [d("01-01"), d("01-29"), d("02-26")]; // due 26 March

  it("chases from a few days before the due date", () => {
    expect(isDueForRefill(refillCycle(dates, d("03-20")))).toBe(false);
    expect(isDueForRefill(refillCycle(dates, d("03-24")))).toBe(true);
    expect(isDueForRefill(refillCycle(dates, d("04-10")))).toBe(true);
  });

  it("gives up on someone a month overdue", () => {
    expect(isDueForRefill(refillCycle(dates, d("05-10")))).toBe(false);
  });

  it("never chases a customer we know nothing about", () => {
    expect(isDueForRefill(refillCycle([d("02-26")], d("03-30")))).toBe(false);
  });
});
