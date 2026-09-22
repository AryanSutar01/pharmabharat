// Order lifecycle. Plain module (no mongoose) so client components can use it.

export const ORDER_STATUSES = [
  "placed",
  "accepted",
  "packed",
  "dispatched",
  "delivered",
  "rejected",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_MODES = ["credit", "cod"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export type OrderAction = "accept" | "reject" | "pack" | "dispatch" | "deliver" | "cancel" | "markPaid";

/** Who may perform an action, from which statuses, and where it leads. */
export const TRANSITIONS: Record<
  Exclude<OrderAction, "markPaid">,
  { side: "seller" | "buyer"; from: OrderStatus[]; to: OrderStatus; releasesStock: boolean }
> = {
  accept: { side: "seller", from: ["placed"], to: "accepted", releasesStock: false },
  reject: { side: "seller", from: ["placed"], to: "rejected", releasesStock: true },
  pack: { side: "seller", from: ["accepted"], to: "packed", releasesStock: false },
  dispatch: { side: "seller", from: ["accepted", "packed"], to: "dispatched", releasesStock: false },
  deliver: { side: "seller", from: ["dispatched"], to: "delivered", releasesStock: false },
  cancel: { side: "buyer", from: ["placed", "accepted"], to: "cancelled", releasesStock: true },
};

export function availableActions(status: OrderStatus, side: "seller" | "buyer", paid: boolean): OrderAction[] {
  const actions = (Object.entries(TRANSITIONS) as [OrderAction, (typeof TRANSITIONS)["accept"]][])
    .filter(([, t]) => t.side === side && t.from.includes(status))
    .map(([a]) => a);
  if (side === "seller" && !paid && (status === "dispatched" || status === "delivered")) actions.push("markPaid");
  return actions;
}

export const STATUS_TONE: Record<OrderStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  placed: "info",
  accepted: "info",
  packed: "info",
  dispatched: "warning",
  delivered: "success",
  rejected: "danger",
  cancelled: "neutral",
};

/** Invoices exist once the seller has accepted the order. */
export function hasInvoice(status: OrderStatus) {
  return ["accepted", "packed", "dispatched", "delivered"].includes(status);
}
