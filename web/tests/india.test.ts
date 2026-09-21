import { describe, expect, it } from "vitest";
import { isInterState, isValidGstin } from "@/lib/india";

describe("isValidGstin", () => {
  it("accepts a GSTIN with a correct checksum", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin(" 27aapfu0939f1zv ")).toBe(true);
  });

  it("rejects a wrong checksum digit", () => {
    expect(isValidGstin("27AAPFU0939F1ZA")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isValidGstin("")).toBe(false);
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
    expect(isValidGstin("27AAPFU0939F1XV")).toBe(false);
  });
});

describe("isInterState", () => {
  it("is intra-state when codes match", () => expect(isInterState("27", "27")).toBe(false));
  it("is inter-state when codes differ", () => expect(isInterState("27", "29")).toBe(true));
});
