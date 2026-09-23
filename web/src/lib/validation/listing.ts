import { z } from "zod";
import { DOSAGE_FORMS } from "@/lib/catalog/normalize";
import { DRUG_SCHEDULES, GST_RATES, LISTING_FILE_KINDS, MAX_LISTING_FILES, STORAGE_CONDITIONS } from "@/lib/catalog/constants";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "invalid");
const money = z.coerce.number({ error: "invalid" }).positive("invalid").max(1_000_000, "invalid");
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v ? new Date(v) : undefined))
  .refine((d) => d === undefined || !Number.isNaN(d.getTime()), "invalid_date")
  .optional();

export const listingSchema = z
  .object({
    productId: objectId,
    batchNo: z.string().trim().toUpperCase().min(1, "required").max(30, "invalid"),
    mfgDate: optionalDate,
    expiryDate: z.coerce.date({ error: "invalid_date" }),
    mrp: money,
    price: money,
    gstRate: z.coerce.number().pipe(z.literal(GST_RATES, { error: "invalid" })),
    hsn: z.string().trim().regex(/^[0-9]{4,8}$/, "invalid_hsn"),
    stock: z.coerce.number().int("invalid").min(0, "invalid").max(1_000_000, "invalid"),
    minOrderQty: z.coerce.number().int("invalid").min(1, "invalid").max(100_000, "invalid").default(1),
    storage: z.enum(STORAGE_CONDITIONS).default("room"),
    schedule: z.enum(DRUG_SCHEDULES, { error: "required" }),
    conditions: z.array(z.string().max(40)).max(10).default([]),
  })
  .superRefine((l, ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (l.price > l.mrp) ctx.addIssue({ code: "custom", path: ["price"], message: "price_above_mrp" });
    if (l.expiryDate <= today) ctx.addIssue({ code: "custom", path: ["expiryDate"], message: "expiry_past" });
    if (l.mfgDate && l.mfgDate > today) ctx.addIssue({ code: "custom", path: ["mfgDate"], message: "mfg_future" });
    if (l.mfgDate && l.mfgDate >= l.expiryDate) ctx.addIssue({ code: "custom", path: ["expiryDate"], message: "expiry_before_mfg" });
  });

export type ListingInput = z.input<typeof listingSchema>;

export const sellerProductSchema = z.object({
  name: z.string().trim().min(2, "required").max(160),
  manufacturer: z.string().trim().min(2, "required").max(160),
  form: z.enum(DOSAGE_FORMS),
  packSizeLabel: z.string().trim().min(2, "required").max(80),
  mrp: money,
  ingredients: z
    .array(z.object({ salt: z.string().trim().min(2).max(80), strength: z.string().trim().max(30).default("") }))
    .min(1, "ingredient_required")
    .max(4),
});

/** Accepts 2027-03-31, 31/03/2027, 03/2027 or 2027-03 (month → last day of month). */
export function parseFlexibleDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return utcDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return utcDate(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[/-](\d{4})$/) ?? null;
  if (m) return utcDate(+m[2], +m[1] + 1, 0);
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return utcDate(+m[1], +m[2] + 1, 0);
  return null;
}

function utcDate(y: number, month: number, day: number) {
  const d = new Date(Date.UTC(y, month - 1, day));
  return Number.isNaN(d.getTime()) || y < 2000 || y > 2100 ? null : d;
}

/**
 * Files attached through the listing form: up to 5, at least one photo of the
 * actual box/batch. (CSV imports skip this and show "Photos needed" instead.)
 */
export const listingFilesSchema = z
  .array(z.object({ kind: z.enum(LISTING_FILE_KINDS), publicId: z.string().min(1).max(300) }))
  .max(MAX_LISTING_FILES, "too_many_files")
  .refine((files) => files.some((f) => f.kind === "box"), "box_photo_required")
  .refine((files) => new Set(files.map((f) => f.publicId)).size === files.length, "invalid");

