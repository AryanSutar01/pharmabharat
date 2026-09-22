import "server-only";
import { Business } from "@/lib/models/business";
import type { OrderDoc } from "@/lib/models/order";
import { sendMail } from "@/lib/mail";
import { newOrderSellerEmail, orderConfirmationEmail, orderStatusEmail } from "@/lib/mail/templates";
import { hasInvoice, type OrderStatus } from "@/lib/orders/status";
import { getUsersByIds } from "@/lib/users";

/** Business email + owner's login email (deduplicated). */
async function recipients(businessId: unknown) {
  const b = await Business.findById(businessId, { email: 1, ownerUserId: 1 }).lean();
  if (!b) return [];
  const owner = (await getUsersByIds([b.ownerUserId])).get(b.ownerUserId);
  return [...new Set([b.email, owner?.email].filter((e): e is string => Boolean(e)))];
}

const summary = (o: OrderDoc, counterparty: string) => ({
  id: String(o._id),
  orderNo: o.orderNo,
  counterparty,
  itemCount: o.items.length,
  grandTotal: o.totals?.grandTotal ?? 0,
});

/** Fire-and-forget: failures are logged inside sendMail, never thrown. */
export async function notifyOrdersPlaced(orders: OrderDoc[]) {
  if (!orders.length) return;
  for (const o of orders) {
    for (const to of await recipients(o.sellerId)) await sendMail({ to, ...newOrderSellerEmail(summary(o, o.buyer.name)) });
  }
  const mail = orderConfirmationEmail(orders.map((o) => summary(o, o.seller.name)));
  for (const to of await recipients(orders[0].buyerId)) await sendMail({ to, ...mail });
}

export async function notifyStatusChange(o: OrderDoc, note?: string) {
  const status = o.status as OrderStatus;
  if (status === "cancelled") {
    // Buyer cancelled → tell the seller.
    for (const to of await recipients(o.sellerId)) {
      await sendMail({
        to,
        ...orderStatusEmail({ ...summary(o, o.buyer.name), status, note, hasInvoice: false }),
      });
    }
    return;
  }
  for (const to of await recipients(o.buyerId)) {
    await sendMail({
      to,
      ...orderStatusEmail({ ...summary(o, o.seller.name), status, note, hasInvoice: hasInvoice(status) }),
    });
  }
}
