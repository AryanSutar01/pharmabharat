import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/ledger/constants";

export const recordPaymentSchema = z.object({
  buyerId: z.string().length(24, "invalid_id"),
  amount: z.coerce.number().positive("invalid_amount").max(1_00_00_000, "invalid_amount"),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(80).optional(),
  note: z.string().trim().max(300).optional(),
  receivedAt: z.coerce.date().max(new Date(Date.now() + 24 * 3600 * 1000), "invalid_date").optional(),
});

export const creditTermsSchema = z.object({
  buyerId: z.string().length(24, "invalid_id"),
  creditLimit: z.coerce.number().min(0).max(10_00_00_000),
  creditDays: z.coerce.number().int().min(0).max(180),
  note: z.string().trim().max(300).optional(),
});
