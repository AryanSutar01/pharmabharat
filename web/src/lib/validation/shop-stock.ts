import { z } from "zod";
import { DRUG_SCHEDULES, GST_RATES } from "@/lib/catalog/constants";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "invalid");
const money = z.coerce.number({ error: "invalid" }).min(0, "invalid").max(1_000_000, "invalid");

export const shopStockSchema = z
  .object({
    productId: objectId,
    batchNo: z.string().trim().toUpperCase().min(1, "required").max(30, "invalid"),
    expiryDate: z.coerce.date({ error: "invalid_date" }),
    qty: z.coerce.number().int("invalid").min(0, "invalid").max(1_000_000, "invalid"),
    /** Tablets in a strip. 1 means the pack cannot be split (a bottle, a tube). */
    unitsPerPack: z.coerce.number().int("invalid").min(1, "invalid").max(1000, "invalid").default(1),
    /** Purchase rate per pack, excluding GST. */
    cost: money,
    mrp: money.refine((v) => v > 0, "invalid"),
    gstRate: z.coerce.number().pipe(z.literal(GST_RATES, { error: "invalid" })),
    hsn: z
      .string()
      .trim()
      .regex(/^[0-9]{4,8}$/, "invalid_hsn")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    schedule: z.enum(DRUG_SCHEDULES).optional(),
    supplierName: z.string().trim().max(120).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.cost > s.mrp) ctx.addIssue({ code: "custom", path: ["cost"], message: "cost_above_mrp" });
  });

export type ShopStockInput = z.input<typeof shopStockSchema>;
