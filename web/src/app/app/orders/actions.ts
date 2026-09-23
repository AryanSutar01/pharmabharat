"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { checkPriceAlertsSafely } from "@/lib/alerts/price";
import { connectDB } from "@/lib/db/mongo";
import { Order } from "@/lib/models/order";
import { notifyStatusChange } from "@/lib/orders/notify";
import { markOrderPaid, transitionOrder } from "@/lib/orders/service";
import { receiveOrderSafely } from "@/lib/retail/stock";
import { TRANSITIONS, type OrderStatus } from "@/lib/orders/status";
import { can } from "@/lib/permissions";
import { requireBusiness } from "@/lib/session";

export type OrderActionResult = { ok?: boolean; error?: string };

const schema = z.object({
  action: z.enum(["accept", "reject", "pack", "dispatch", "deliver", "cancel", "markPaid"]),
  note: z.string().trim().max(500).optional(),
});

export async function orderAction(orderId: string, _: OrderActionResult, formData: FormData): Promise<OrderActionResult> {
  const { business, role, session } = await requireBusiness();
  const parsed = schema.safeParse({ action: formData.get("action"), note: formData.get("note") || undefined });
  if (!parsed.success || !isValidObjectId(orderId)) return { error: "invalid" };
  const { action, note } = parsed.data;

  await connectDB();
  const order = await Order.findById(orderId, { buyerId: 1, sellerId: 1, status: 1 }).lean();
  if (!order) return { error: "not_found" };
  const isSeller = String(order.sellerId) === String(business._id) && can(role, "orders.manage");
  const isBuyer = String(order.buyerId) === String(business._id) && can(role, "orders.place");

  if (action === "markPaid") {
    if (!isSeller) return { error: "forbidden" };
    if (!(await markOrderPaid(orderId, { id: session.user.id, name: session.user.name }))) return { error: "invalid_transition" };
  } else {
    const t = TRANSITIONS[action];
    if ((t.side === "seller" && !isSeller) || (t.side === "buyer" && !isBuyer)) return { error: "forbidden" };
    if (!t.from.includes(order.status as OrderStatus)) return { error: "invalid_transition" };
    if (action === "reject" && !note) return { error: "remarks_required" };
    const updated = await transitionOrder({ orderId, action, userId: session.user.id, note });
    if (!updated) return { error: "invalid_transition" };
    after(async () => {
      await notifyStatusChange(updated, note);
      // A delivered order lands on the retailer's own shelf (see lib/retail/stock).
      if (action === "deliver") await receiveOrderSafely(updated._id, session.user.id);
      if (t.releasesStock) await checkPriceAlertsSafely(updated.items.map((i) => i.productId));
    });
  }

  revalidatePath(`/app/orders/${orderId}`);
  revalidatePath("/app/orders");
  return { ok: true };
}
