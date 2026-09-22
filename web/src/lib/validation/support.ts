import { z } from "zod";
import { PHONE_RE } from "@/lib/india";
import { CALLBACK_SLOTS, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/support/constants";

export const ticketSchema = z.object({
  kind: z.literal("ticket"),
  category: z.enum(TICKET_CATEGORIES, { error: "required" }),
  priority: z.enum(TICKET_PRIORITIES).default("normal"),
  subject: z.string().trim().min(5, "too_short").max(150),
  message: z.string().trim().min(10, "too_short").max(5000),
  orderNo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^PB-\d{4}-\d{6}$/, "invalid_order_no")
    .transform((v) => v || undefined)
    .optional(),
});

export const callbackSchema = z.object({
  kind: z.literal("callback"),
  category: z.enum(TICKET_CATEGORIES, { error: "required" }),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").slice(-10))
    .pipe(z.string().regex(PHONE_RE, "invalid_phone")),
  slot: z.enum(CALLBACK_SLOTS, { error: "required" }),
  language: z.enum(["en", "hi", "mr"]).default("en"),
  message: z.string().trim().max(1000).default(""),
});

export const newTicketSchema = z.discriminatedUnion("kind", [ticketSchema, callbackSchema]);
export type NewTicketInput = z.output<typeof newTicketSchema>;

export const replySchema = z.object({ text: z.string().trim().min(1, "required").max(5000) });

export const deskUpdateSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
});
