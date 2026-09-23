import { describe, expect, it } from "vitest";
import { parsePurchaseList } from "@/lib/orders/quick-list";

const parse = (s: string) => parsePurchaseList(s).map(({ name, qty }) => ({ name, qty }));

describe("parsePurchaseList", () => {
  it("reads the shapes a chemist actually pastes", () => {
    expect(
      parse(`Dolo 650 Tablet, 10
Azithral 500 Tablet\t5
Pan D Capsule | 3
Crocin Advance x 12`),
    ).toEqual([
      { name: "Dolo 650 Tablet", qty: 10 },
      { name: "Azithral 500 Tablet", qty: 5 },
      { name: "Pan D Capsule", qty: 3 },
      { name: "Crocin Advance", qty: 12 },
    ]);
  });

  it("drops serial numbers, headers and blank lines", () => {
    expect(
      parse(`S.No, Product, Qty

1. Dolo 650 Tablet - 10 strips
2) Pan D Capsule, 2`),
    ).toEqual([
      { name: "Dolo 650 Tablet", qty: 10 },
      { name: "Pan D Capsule", qty: 2 },
    ]);
  });

  it("defaults to one when no quantity is given", () => {
    expect(parse("Shelcal 500 Tablet")).toEqual([{ name: "Shelcal 500 Tablet", qty: 1 }]);
  });

  it("keeps numbers that are part of the name", () => {
    expect(parse("Dolo 650 Tablet")).toEqual([{ name: "Dolo 650 Tablet", qty: 1 }]);
    expect(parse("Vitamin B12 Injection, 4")).toEqual([{ name: "Vitamin B12 Injection", qty: 4 }]);
  });

  it("merges repeats of the same product", () => {
    expect(parse("Dolo 650 Tablet, 10\ndolo 650 tablet, 5")).toEqual([{ name: "Dolo 650 Tablet", qty: 15 }]);
  });

  it("caps the list length", () => {
    const many = Array.from({ length: 300 }, (_, i) => `Product ${i} Tablet, 1`).join("\n");
    expect(parsePurchaseList(many)).toHaveLength(200);
  });
});
