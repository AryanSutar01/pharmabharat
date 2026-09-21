import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import hi from "../messages/hi.json";
import mr from "../messages/mr.json";
import { can } from "@/lib/permissions";

describe("permissions", () => {
  it("only owners manage the team and business profile", () => {
    expect(can("owner", "team.manage")).toBe(true);
    expect(can("manager", "team.manage")).toBe(false);
    expect(can("manager", "business.edit")).toBe(false);
  });

  it("viewers are read-only", () => {
    expect(can("viewer", "orders.place")).toBe(false);
    expect(can("viewer", "inventory.manage")).toBe(false);
    expect(can("viewer", "analytics.view")).toBe(true);
  });
});

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("translations", () => {
  const base = keys(en).sort();
  it.each([
    ["hi", hi],
    ["mr", mr],
  ])("%s has exactly the same keys as en", (_, messages) => {
    expect(keys(messages).sort()).toEqual(base);
  });
});
