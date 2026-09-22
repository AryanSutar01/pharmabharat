// Plain constants (client-safe) for customer care.

export const TICKET_KINDS = ["ticket", "callback"] as const;
export type TicketKind = (typeof TICKET_KINDS)[number];

export const TICKET_CATEGORIES = ["order", "payment", "invoice", "account", "kyc", "catalog", "technical", "other"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = ["open", "in_progress", "waiting_on_customer", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Statuses a ticket counts as "open" in queues and lists. */
export const ACTIVE_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_on_customer"];

export const CALLBACK_SLOTS = ["morning", "afternoon", "evening"] as const;
export type CallbackSlot = (typeof CALLBACK_SLOTS)[number];

export const STATUS_TONE: Record<TicketStatus, "info" | "warning" | "success" | "neutral"> = {
  open: "info",
  in_progress: "info",
  waiting_on_customer: "warning",
  resolved: "success",
  closed: "neutral",
};

export const PRIORITY_TONE: Record<TicketPriority, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};
