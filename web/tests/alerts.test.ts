import { describe, expect, it } from "vitest";
import { dueExpiryLevel, pctChange, shouldNotifyPrice } from "@/lib/alerts/rules";

describe("shouldNotifyPrice", () => {
  const base = { reference: 100, thresholdPct: 5 };

  it("fires on a drop past the threshold for drop/any alerts", () => {
    expect(shouldNotifyPrice({ ...base, current: 94, direction: "drop" })).toBe(true);
    expect(shouldNotifyPrice({ ...base, current: 94, direction: "any" })).toBe(true);
    expect(shouldNotifyPrice({ ...base, current: 94, direction: "rise" })).toBe(false);
  });

  it("fires on a rise past the threshold for rise/any alerts", () => {
    expect(shouldNotifyPrice({ ...base, current: 106, direction: "rise" })).toBe(true);
    expect(shouldNotifyPrice({ ...base, current: 106, direction: "drop" })).toBe(false);
  });

  it("ignores moves smaller than the threshold", () => {
    expect(shouldNotifyPrice({ ...base, current: 96, direction: "any" })).toBe(false);
    expect(shouldNotifyPrice({ ...base, current: 95, direction: "drop" })).toBe(true); // exactly 5%
  });

  it("treats a 0% threshold as any real change, and ignores no-ops and bad data", () => {
    expect(shouldNotifyPrice({ reference: 100, current: 99.5, thresholdPct: 0, direction: "drop" })).toBe(true);
    expect(shouldNotifyPrice({ reference: 100, current: 100, thresholdPct: 0, direction: "any" })).toBe(false);
    expect(shouldNotifyPrice({ reference: 0, current: 50, thresholdPct: 0, direction: "any" })).toBe(false);
  });

  it("computes percentage change", () => {
    expect(pctChange(80, 72)).toBe(-10);
    expect(pctChange(33.6, 35)).toBe(4.2);
  });
});

describe("dueExpiryLevel", () => {
  it("sends each level once, tightest first", () => {
    expect(dueExpiryLevel(120, null)).toBeNull();
    expect(dueExpiryLevel(90, null)).toBe(90);
    expect(dueExpiryLevel(80, 90)).toBeNull();
    expect(dueExpiryLevel(60, 90)).toBe(60);
    expect(dueExpiryLevel(29, 60)).toBe(30);
    expect(dueExpiryLevel(10, 30)).toBeNull();
  });

  it("jumps straight to the tightest crossed level for newly listed short-dated stock", () => {
    expect(dueExpiryLevel(45, null)).toBe(60);
    expect(dueExpiryLevel(20, null)).toBe(30);
  });

  it("does not alert on already-expired stock", () => {
    expect(dueExpiryLevel(0, null)).toBeNull();
    expect(dueExpiryLevel(-5, 30)).toBeNull();
  });
});
