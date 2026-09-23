import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { getFormatter, getTranslations } from "next-intl/server";
import { Alert, Badge, Card, CardHeader, PageHeader, buttonClass, cn } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { stateName } from "@/lib/india";
import { Order } from "@/lib/models/order";
import { STATUS_TONE, availableActions, hasInvoice, type OrderStatus } from "@/lib/orders/status";
import { can } from "@/lib/permissions";
import { recallsForBatches } from "@/lib/recalls/service";
import { requireBusiness } from "@/lib/session";
import { ChatButton } from "@/components/chat-button";
import { OrderActions } from "./order-actions";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: PageProps<"/app/orders/[id]">) {
  const { business, role } = await requireBusiness();
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await connectDB();
  const order = await Order.findOne({ _id: id, $or: [{ buyerId: business._id }, { sellerId: business._id }] }).lean();
  if (!order) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const now = new Date();
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const monthYear = (d: Date) => format.dateTime(new Date(d), { month: "short", year: "numeric" });

  const side = String(order.sellerId) === String(business._id) ? "seller" : "buyer";
  const status = order.status as OrderStatus;
  const allowed = side === "seller" ? can(role, "orders.manage") : can(role, "orders.place");
  const actions = allowed ? availableActions(status, side, order.payment?.status === "paid") : [];
  const other = side === "seller" ? order.buyer : order.seller;
  const totals = order.totals!;
  const recalls = await recallsForBatches(order.items.map((i) => i.batchNo));

  return (
    <>
      <Link href={`/app/orders?tab=${side === "seller" ? "sales" : "purchases"}`} className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← {t("orders.title")}
      </Link>
      <PageHeader
        title={order.orderNo}
        description={`${side === "seller" ? t("orders.from") : t("orders.to")} ${other.name} · ${format.dateTime(new Date(order.createdAt), { dateStyle: "medium", timeStyle: "short" })}`}
        action={
          <div className="flex gap-2">
            <Badge tone={order.payment?.status === "paid" ? "success" : "neutral"}>
              {order.payment?.status === "paid" ? t("orders.paid") : t("orders.unpaid")} · {t(`cart.${order.payment?.mode ?? "credit"}`)}
            </Badge>
            <Badge tone={STATUS_TONE[status]}>{t(`orders.statusLabel.${status}`)}</Badge>
          </div>
        }
      />

      {recalls.length ? (
        <div className="mb-5">
          <Alert tone="danger" title={t("orders.recallTitle")}>
            <ul className="mt-1 space-y-1">
              {recalls.map((r) => (
                <li key={String(r._id)}>
                  <b>
                    {r.productName} · {r.batchNo}
                  </b>{" "}
                  — {r.reason}
                  {r.reference ? ` (${r.reference})` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2">{t(`orders.recallAction.${side}`)}</p>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title={t("orders.items", { count: order.items.length })}
              description={order.interState ? t("cart.interState") : t("cart.sameState")}
            />
            <ul className="divide-y divide-line">
              {order.items.map((it, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <Link href={`/app/catalog/${it.productId}`} className="font-medium hover:underline">
                      {it.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {it.packSizeLabel} · {t("orders.batch")} {it.batchNo} · {t("orders.exp")} {monthYear(it.expiryDate)} · HSN{" "}
                      {it.hsn}
                    </p>
                    <p className="text-xs text-muted">
                      {inr(it.price)} × {it.qty} · {t("catalog.gst")} {it.gstRate}%
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{inr(it.total)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line px-4 py-3 text-sm sm:px-5">
              <Row label={t("cart.taxable")} value={inr(totals.taxable)} />
              {order.interState ? (
                <Row label={t("cart.igst")} value={inr(totals.igst)} />
              ) : (
                <>
                  <Row label={t("cart.cgst")} value={inr(totals.cgst)} />
                  <Row label={t("cart.sgst")} value={inr(totals.sgst)} />
                </>
              )}
              <Row label={t("cart.roundOff")} value={inr(totals.roundOff)} />
              <Row label={t("cart.grandTotal")} value={inr(totals.grandTotal)} strong />
            </dl>
          </Card>

          <div className="grid gap-5 sm:grid-cols-2">
            {[
              { title: t("orders.from"), p: order.seller },
              { title: t("orders.to"), p: order.buyer },
            ].map(({ title, p }) => (
              <Card key={title} className="p-4 text-sm sm:p-5">
                <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
                <p className="mt-1 font-semibold">{p.name}</p>
                <p className="mt-1 text-muted">{p.address}</p>
                <p className="mt-1 text-muted">
                  {stateName(p.stateCode)} · GSTIN {p.gstin ?? "—"}
                </p>
                {p.phone ? <p className="text-muted">{p.phone}</p> : null}
              </Card>
            ))}
          </div>

          {order.notes ? (
            <Card className="p-4 text-sm sm:p-5">
              <p className="text-xs uppercase tracking-wide text-muted">{t("orders.buyerNote")}</p>
              <p className="mt-1 whitespace-pre-line">{order.notes}</p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title={t("orders.invoice")} />
            <div className="p-4 text-sm sm:p-5">
              {hasInvoice(status) && order.invoice?.number ? (
                <>
                  <p className="mb-3 text-muted">{t("orders.invoiceNo", { number: order.invoice.number })}</p>
                  <a href={`/api/orders/${order._id}/invoice`} target="_blank" rel="noopener" className={buttonClass("secondary", "w-full")}>
                    ↓ {t("orders.downloadInvoice")}
                  </a>
                </>
              ) : (
                <p className="text-muted">{t("orders.invoiceAfterAccept")}</p>
              )}
            </div>
          </Card>

          {order.payment?.dueAt && order.payment.status !== "paid" ? (
            <Card>
              <CardHeader title={t("orders.payment")} />
              <div className="space-y-2 p-4 text-sm sm:p-5">
                <div className="flex justify-between">
                  <span className="text-muted">{t("orders.dueOn")}</span>
                  <span className={cn("font-medium", new Date(order.payment.dueAt) < now && "text-red-600")}>
                    {format.dateTime(new Date(order.payment.dueAt), { dateStyle: "medium" })}
                  </span>
                </div>
                {order.payment.paidAmount ? (
                  <div className="flex justify-between">
                    <span className="text-muted">{t("orders.paidSoFar")}</span>
                    <span className="font-medium tabular-nums">{inr(order.payment.paidAmount)}</span>
                  </div>
                ) : null}
                <Link href={`/app/ledger/${side === "seller" ? order.buyerId : order.sellerId}?side=${side}`} className="block pt-1 text-brand-700 hover:underline">
                  {t("ledger.statement")} →
                </Link>
              </div>
            </Card>
          ) : null}

          {can(role, "chat.use") ? (
            <ChatButton
              businessId={String(side === "seller" ? order.buyerId : order.sellerId)}
              label={t("chat.chatWith", { name: other.name })}
              className="w-full"
            />
          ) : null}

          {actions.length ? (
            <Card>
              <CardHeader title={t("orders.actions")} />
              <div className="p-4 sm:p-5">
                <OrderActions orderId={String(order._id)} actions={actions} />
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t("orders.timeline")} />
            <ol className="space-y-3 p-4 text-sm sm:p-5">
              {order.history.map((h, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" aria-hidden />
                  <div>
                    <p className="font-medium">{t(`orders.statusLabel.${h.status}`)}</p>
                    <p className="text-xs text-muted">{format.dateTime(new Date(h.at ?? order.createdAt), { dateStyle: "medium", timeStyle: "short" })}</p>
                    {h.note ? <p className="mt-0.5 text-muted">“{h.note}”</p> : null}
                  </div>
                </li>
              ))}
              {order.payment?.status === "paid" && order.payment.paidAt ? (
                <li className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" aria-hidden />
                  <div>
                    <p className="font-medium">{t("orders.paid")}</p>
                    <p className="text-xs text-muted">{format.dateTime(new Date(order.payment.paidAt), { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                </li>
              ) : null}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t border-line pt-2 text-base font-semibold" : "flex justify-between text-muted"}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
