import { describe, expect, it } from "vitest";
import {
  inPacks,
  isDivisible,
  packsAndLoose,
  parsePackUnits,
  rateFor,
  unitCost,
  unitPrice,
  unitsSold,
} from "@/lib/retail/units";

describe("packsAndLoose", () => {
  it("splits a unit count into whole strips and the cut one", () => {
    expect(packsAndLoose(176, 15)).toMatchObject({ packs: 11, loose: 11 });
    expect(packsAndLoose(180, 15)).toMatchObject({ packs: 12, loose: 0 });
    expect(packsAndLoose(7, 15)).toMatchObject({ packs: 0, loose: 7 });
  });

  it("treats an indivisible pack as one unit", () => {
    expect(packsAndLoose(3, 1)).toMatchObject({ packs: 3, loose: 0 });
  });

  it("never goes negative", () => {
    expect(packsAndLoose(-5, 15)).toMatchObject({ packs: 0, loose: 0 });
  });
});

describe("unitPrice", () => {
  it("divides the strip MRP and rounds the paise up, as shops do", () => {
    expect(unitPrice(105, 15)).toBe(7); // exact
    expect(unitPrice(87, 10)).toBe(8.7);
    expect(unitPrice(100, 3)).toBe(33.34); // 33.333… rounded up
  });

  it("can be told to keep it exact instead", () => {
    expect(unitPrice(100, 3, "exact")).toBe(33.33);
  });

  it("is just the MRP when the pack can't be split", () => {
    expect(unitPrice(210, 1)).toBe(210);
  });
});

describe("unitsSold", () => {
  it("counts a strip as its whole content and a tablet as one", () => {
    expect(unitsSold(2, "pack", 15)).toBe(30);
    expect(unitsSold(4, "unit", 15)).toBe(4);
    expect(unitsSold(1, "pack", 1)).toBe(1);
  });
});

describe("rateFor", () => {
  it("charges the strip MRP for a strip and the per-tablet price for tablets", () => {
    expect(rateFor({ mrp: 105, saleUnit: "pack", unitsPerPack: 15 })).toBe(105);
    expect(rateFor({ mrp: 105, saleUnit: "unit", unitsPerPack: 15 })).toBe(7);
  });
});

describe("cost and packs", () => {
  it("spreads the purchase cost across the tablets", () => {
    expect(unitCost(90, 15)).toBe(6);
    expect(unitCost(90, 1)).toBe(90);
  });

  it("counts part strips when valuing the shelf", () => {
    expect(inPacks(176, 15)).toBe(11.73);
    expect(inPacks(30, 1)).toBe(30);
  });

  it("knows what can be cut", () => {
    expect(isDivisible(15)).toBe(true);
    expect(isDivisible(1)).toBe(false);
  });
});

describe("parsePackUnits", () => {
  it("reads the count out of the catalogue's pack label", () => {
    expect(parsePackUnits("strip of 15")).toBe(15);
    expect(parsePackUnits("Strip of 10 tablets")).toBe(10);
    expect(parsePackUnits("1 x 10")).toBe(10);
    expect(parsePackUnits("10's")).toBe(10);
    expect(parsePackUnits("15 tablets")).toBe(15);
    expect(parsePackUnits("packet of 5 sachets")).toBe(5);
  });

  it("refuses to split what is measured, not counted", () => {
    expect(parsePackUnits("100 ml")).toBeNull();
    expect(parsePackUnits("bottle of 200 ml")).toBeNull();
    expect(parsePackUnits("30 gm tube")).toBeNull();
    expect(parsePackUnits("prefilled syringe")).toBeNull();
  });

  it("gives up rather than guess", () => {
    expect(parsePackUnits("")).toBeNull();
    expect(parsePackUnits(null)).toBeNull();
    expect(parsePackUnits("strip of 1")).toBeNull();
  });
});
