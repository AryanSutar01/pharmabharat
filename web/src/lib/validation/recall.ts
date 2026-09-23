import { z } from "zod";
import { RECALL_SEVERITIES } from "@/lib/recalls/constants";

export const recallSchema = z.object({
  productName: z.string().trim().min(3, "too_short").max(200),
  manufacturer: z.string().trim().max(200).optional(),
  batchNo: z.string().trim().min(1, "required").max(40),
  severity: z.enum(RECALL_SEVERITIES),
  reason: z.string().trim().min(10, "too_short").max(1000),
  reference: z.string().trim().max(300).optional(),
});
