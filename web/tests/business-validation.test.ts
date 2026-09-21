import { describe, expect, it } from "vitest";
import { businessProfileSchema, fieldErrors } from "@/lib/validation/business";

const nextYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

const valid = {
  type: "wholesaler" as const,
  legalName: "Test Pharma Distributors",
  tradeName: "",
  gstin: "27AAPFU0939F1ZV",
  pan: "AAPFU0939F",
  phone: "9876543210",
  email: "Owner@Example.com",
  address: { line1: "12 MG Road", line2: "", city: "Pune", district: "", stateCode: "27", pincode: "411001" },
  drugLicenses: [{ form: "20B", number: "mh-pz1-123456", validTill: nextYear }],
  pharmacist: { name: "", registrationNumber: "" },
  fssaiNumber: "",
};

function errorsFor(input: unknown) {
  const r = businessProfileSchema.safeParse(input);
  return r.success ? {} : fieldErrors(r.error);
}

describe("businessProfileSchema", () => {
  it("accepts a complete wholesaler profile and normalises values", () => {
    const r = businessProfileSchema.parse(valid);
    expect(r.email).toBe("owner@example.com");
    expect(r.drugLicenses[0].number).toBe("MH-PZ1-123456");
    expect(r.tradeName).toBeUndefined();
  });

  it("requires PAN to match the GSTIN", () => {
    expect(errorsFor({ ...valid, pan: "ABCDE1234F" }).pan).toBe("pan_gstin_mismatch");
  });

  it("requires the state to match the GSTIN state code", () => {
    expect(errorsFor({ ...valid, address: { ...valid.address, stateCode: "29" } })["address.stateCode"]).toBe(
      "state_gstin_mismatch",
    );
  });

  it("rejects licence forms that don't apply to the business type", () => {
    const e = errorsFor({ ...valid, drugLicenses: [{ ...valid.drugLicenses[0], form: "20" }] });
    expect(e["drugLicenses.0.form"]).toBe("invalid_license_form");
  });

  it("rejects expired licences", () => {
    const e = errorsFor({ ...valid, drugLicenses: [{ ...valid.drugLicenses[0], validTill: "2020-01-01" }] });
    expect(e["drugLicenses.0.validTill"]).toBe("license_expired");
  });

  it("requires a pharmacist for retailers", () => {
    const e = errorsFor({ ...valid, type: "retailer", drugLicenses: [{ ...valid.drugLicenses[0], form: "20" }] });
    expect(e["pharmacist.name"]).toBe("required");
    expect(e["pharmacist.registrationNumber"]).toBe("required");
  });
});
