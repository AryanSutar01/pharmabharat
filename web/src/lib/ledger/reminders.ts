import "server-only";
import { connectDB } from "@/lib/db/mongo";
import { sendMail } from "@/lib/mail";
import { paymentReminderEmail } from "@/lib/mail/templates";
import { Business } from "@/lib/models/business";
import { Order } from "@/lib/models/order";
import { notify } from "@/lib/notifications";
import { round2 } from "@/lib/orders/gst";
import { getUsersByIds } from "@/lib/users";
import { daysOverdue } from "./allocate";

const DAY = 24 * 3600 * 1000;
/** Don't nag: at most one reminder per invoice per week. */
const COOLDOWN_DAYS = 7;
const MAX_PER_RUN = 2000;

/**
 * Daily job: remind buyers about invoices past their due date, one email per
 * buyer–seller pair. Each order records when it was last reminded, so
 * re-running the job on the same day sends nothing.
 */
export async function runPaymentReminders(now = new Date()) {
  await connectDB();
  const cooldown = new Date(now.getTime() - COOLDOWN_DAYS * DAY);
  const overdue = await Order.find(
    {
      status: { $in: ["accepted", "packed", "dispatched", "delivered"] },
      "payment.status": { $ne: "paid" },
      "payment.dueAt": { $lt: now },
      $or: [{ "payment.reminderAt": { $lt: cooldown } }, { "payment.reminderAt": null }],
    },
    { orderNo: 1, sellerId: 1, buyerId: 1, invoice: 1, totals: 1, payment: 1 },
  )
    .limit(MAX_PER_RUN)
    .lean();
  if (!overdue.length) return { pairs: 0, invoices: 0 };

  // One reminder per buyer–seller pair, listing every late invoice.
  const byPair = new Map<string, typeof overdue>();
  for (const o of overdue) {
    const key = `${o.sellerId}:${o.buyerId}`;
    byPair.set(key, [...(byPair.get(key) ?? []), o]);
  }

  const ids = [...new Set(overdue.flatMap((o) => [String(o.sellerId), String(o.buyerId)]))];
  const businesses = await Business.find(
    { _id: { $in: ids } },
    { legalName: 1, tradeName: 1, email: 1, ownerUserId: 1 },
  ).lean();
  const bizById = new Map(businesses.map((b) => [String(b._id), b]));
  const owners = await getUsersByIds(businesses.map((b) => b.ownerUserId));

  for (const [key, orders] of byPair) {
    const [sellerId, buyerId] = key.split(":");
    const seller = bizById.get(sellerId);
    const buyer = bizById.get(buyerId);
    if (!seller || !buyer) continue;

    const invoices = orders
      .map((o) => ({
        orderNo: o.orderNo,
        invoiceNo: o.invoice?.number ?? undefined,
        amount: round2((o.totals?.grandTotal ?? 0) - (o.payment?.paidAmount ?? 0)),
        dueAt: new Date(o.payment?.dueAt ?? o.createdAt),
        daysOverdue: daysOverdue(o.payment?.dueAt ? new Date(o.payment.dueAt) : null, now),
      }))
      .filter((i) => i.amount > 0.009)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
    if (!invoices.length) continue;
    const total = round2(invoices.reduce((a, i) => a + i.amount, 0));

    await notify({
      businessId: buyer._id,
      permission: "billing.view",
      kind: "payment_due",
      params: {
        orderNo: invoices[0].invoiceNo || invoices[0].orderNo,
        party: seller.tradeName || seller.legalName,
        amount: total,
        days: invoices[0].daysOverdue,
      },
      link: `/app/ledger/${seller._id}?side=buyer`,
    });

    const mail = paymentReminderEmail({
      buyerName: buyer.tradeName || buyer.legalName,
      sellerName: seller.tradeName || seller.legalName,
      invoices,
      total,
    });
    for (const to of new Set([buyer.email, owners.get(buyer.ownerUserId)?.email].filter((e): e is string => Boolean(e)))) {
      await sendMail({ to, ...mail });
    }
  }

  await Order.updateMany({ _id: { $in: overdue.map((o) => o._id) } }, { $set: { "payment.reminderAt": now } });
  return { pairs: byPair.size, invoices: overdue.length };
}
