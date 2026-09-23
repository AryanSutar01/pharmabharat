import { describe, expect, it } from "vitest";
import { MAX_LISTING_FILES, PUBLIC_LISTING_FILE_KINDS } from "@/lib/catalog/constants";
import { listingFilesSchema } from "@/lib/validation/listing";

const file = (kind: "box" | "invoice" | "other", n: number) => ({ kind, publicId: `pharmabharat/listings/s1/f${n}` });

describe("listing files", () => {
  it("accepts up to 5 files as long as one shows the box/batch", () => {
    expect(listingFilesSchema.safeParse([file("box", 1)]).success).toBe(true);
    const five = [file("box", 1), file("invoice", 2), file("other", 3), file("other", 4), file("other", 5)];
    expect(listingFilesSchema.safeParse(five).success).toBe(true);
    expect(five).toHaveLength(MAX_LISTING_FILES);
  });

  it("requires a box photo and rejects extras or duplicates", () => {
    const noBox = listingFilesSchema.safeParse([file("invoice", 1)]);
    expect(noBox.success).toBe(false);
    expect(noBox.error?.issues[0].message).toBe("box_photo_required");

    const tooMany = listingFilesSchema.safeParse([1, 2, 3, 4, 5, 6].map((n) => file("box", n)));
    expect(tooMany.error?.issues[0].message).toBe("too_many_files");

    expect(listingFilesSchema.safeParse([file("box", 1), file("other", 1)]).success).toBe(false); // same publicId twice
  });

  it("keeps the purchase invoice out of what buyers see", () => {
    expect(PUBLIC_LISTING_FILE_KINDS).toEqual(["box", "other"]);
    expect(PUBLIC_LISTING_FILE_KINDS).not.toContain("invoice");
  });
});
