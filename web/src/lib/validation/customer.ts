import { z } from "zod";
import { CUSTOMER_CONDITIONS } from "@/lib/retail/constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const customerSchema = z.object({
  name: z.string().trim().min(2, "required").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "invalid_phone")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  email: z.email("invalid_email").optional().or(z.literal("").transform(() => undefined)),
  birthYear: z.coerce
    .number()
    .int()
    .min(1900, "invalid")
    .max(new Date().getFullYear(), "invalid")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: optionalText(240),
  notes: optionalText(500),
  conditions: z.array(z.enum(CUSTOMER_CONDITIONS)).max(7).default([]),
  /** DPDP: the shop confirms the customer agreed to their details being kept. */
  consent: z.coerce.boolean(),
  /** Separate tick: may we email refill reminders? */
  reminders: z.coerce.boolean().default(false),
});

export type CustomerInput = z.input<typeof customerSchema>;
