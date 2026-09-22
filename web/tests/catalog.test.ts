import { describe, expect, it } from "vitest";
import { compositionKeys, detectForm, marginPercent, parseIngredient } from "@/lib/catalog/normalize";
import { listingSchema, parseFlexibleDate } from "@/lib/validation/listing";

describe("parseIngredient", () => {
  it("splits salt and strength and normalises spacing", () => {
    expect(parseIngredient("Amoxycillin  (500mg) ")).toEqual({ salt: "Amoxycillin", strength: "500mg" });
    expect(parseIngredient(" Ambroxol (30mg/5ml) ")).toEqual({ salt: "Ambroxol", strength: "30mg/5ml" });
    expect(parseIngredient("Acyclovir (5% w/w)")).toEqual({ salt: "Acyclovir", strength: "5%w/w" });
  });
  it("handles missing strength and empty input", () => {
    expect(parseIngredient("Multivitamin")).toEqual({ salt: "Multivitamin", strength: "" });
    expect(parseIngredient("   ")).toBeNull();
  });
});

describe("compositionKeys", () => {
  it("is order-independent so substitutes match", () => {
    const a = compositionKeys([
      { salt: "Amoxycillin", strength: "500mg" },
      { salt: "Clavulanic Acid", strength: "125mg" },
    ]);
    const b = compositionKeys([
      { salt: "clavulanic acid", strength: "125mg" },
      { salt: "AMOXYCILLIN", strength: "500mg" },
    ]);
    expect(a).toEqual(b);
    expect(a.compositionKey).toBe("amoxycillin 500mg + clavulanic acid 125mg");
    expect(a.saltKey).toBe("amoxycillin + clavulanic acid");
  });
});

describe("detectForm", () => {
  it("reads the form from the name, including abbreviations", () => {
    expect(detectForm("Dolo 650 Tablet")).toBe("tablet");
    expect(detectForm("Glycomet GP 2 Forte SR")).toBe("tablet");
    expect(detectForm("Ascoril LS Syrup")).toBe("syrup");
  });
  it("falls back to the pack container", () => {
    expect(detectForm("Monocef 1gm", "vial of 1 Injection")).toBe("injection");
    expect(detectForm("Something odd", "jar of 50 gm")).toBe("other");
  });
});

describe("marginPercent", () => {
  it("computes retailer margin on MRP", () => {
    expect(marginPercent(100, 80)).toBe(20);
    expect(marginPercent(33.6, 24.5)).toBe(27.1);
    expect(marginPercent(0, 10)).toBe(0);
  });
});

describe("parseFlexibleDate", () => {
  it("accepts the common formats sellers use", () => {
    expect(parseFlexibleDate("2027-03-31")?.toISOString().slice(0, 10)).toBe("2027-03-31");
    expect(parseFlexibleDate("31/03/2027")?.toISOString().slice(0, 10)).toBe("2027-03-31");
    expect(parseFlexibleDate("03/2027")?.toISOString().slice(0, 10)).toBe("2027-03-31"); // last day of month
    expect(parseFlexibleDate("2028-02")?.toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(parseFlexibleDate("tomorrow")).toBeNull();
  });
});

describe("listingSchema", () => {
  const future = new Date(Date.now() + 400 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const base = {
    productId: "0123456789abcdef01234567",
    batchNo: "ab123",
    expiryDate: future,
    mfgDate: "",
    mrp: "33.6",
    price: "24.5",
    gstRate: "5",
    hsn: "3004",
    stock: "100",
    minOrderQty: "1",
    storage: "room",
    schedule: "h",
  };

  it("accepts a valid listing and coerces types", () => {
    const r = listingSchema.parse(base);
    expect(r.batchNo).toBe("AB123");
    expect(r.gstRate).toBe(5);
    expect(r.stock).toBe(100);
    expect(r.mfgDate).toBeUndefined();
  });

  it("rejects a price above MRP", () => {
    const r = listingSchema.safeParse({ ...base, price: "40" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("price_above_mrp");
  });

  it("rejects past expiry and invalid GST rates", () => {
    expect(listingSchema.safeParse({ ...base, expiryDate: "2020-01-01" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, gstRate: "7" }).success).toBe(false);
  });
});
