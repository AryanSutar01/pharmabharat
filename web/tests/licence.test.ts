import { describe, expect, it } from "vitest";
import { daysUntil, dueLicenceWarning, earliestLicence, licenceStatus } from "@/lib/compliance/rules";

const lic = (form: string, validTill: string) => ({ form, number: `${form}-1`, validTill: new Date(validTill) });
const NOW = new Date("2026-09-23T10:00:00Z");

describe("licence validity", () => {
  it("is limited by whichever licence runs out first", () => {
    const licences = [lic("21B", "2027-03-31"), lic("20B", "2026-10-15")];
    expect(earliestLicence(licences)?.form).toBe("20B");
    expect(licenceStatus(licences, NOW)).toMatchObject({ status: "expiring", daysLeft: 22 });
  });

  it("reports ok, expired and missing", () => {
    expect(licenceStatus([lic("20B", "2028-01-01")], NOW).status).toBe("ok");
    expect(licenceStatus([lic("20B", "2026-09-01")], NOW)).toMatchObject({ status: "expired" });
    expect(licenceStatus([], NOW).status).toBe("missing");
  });

  it("counts days to expiry", () => {
    expect(daysUntil("2026-09-30T10:00:00Z", NOW)).toBe(7);
    expect(daysUntil("2026-09-20T10:00:00Z", NOW)).toBe(-3);
  });
});

describe("dueLicenceWarning", () => {
  it("warns once per level, in descending order", () => {
    expect(dueLicenceWarning(59, null)).toBe(60);
    expect(dueLicenceWarning(59, 60)).toBeNull(); // already warned at this level
    expect(dueLicenceWarning(30, 60)).toBe(30);
    expect(dueLicenceWarning(5, 30)).toBe(7);
    expect(dueLicenceWarning(5, 7)).toBeNull();
  });

  it("says nothing outside the warning window or after expiry", () => {
    expect(dueLicenceWarning(90, null)).toBeNull();
    expect(dueLicenceWarning(0, 7)).toBeNull();
    expect(dueLicenceWarning(-4, null)).toBeNull();
  });
});
