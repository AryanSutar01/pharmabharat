import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Alert, Badge, Card, PageHeader, cn } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { isSellerType } from "@/lib/catalog/seller";
import { Order } from "@/lib/models/order";
import { STATUS_TONE, type OrderStatus } from "@/lib/orders/status";
import { can } from "@/lib/permissions";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Orders" };

const OPEN: OrderStatus[] = ["placed", "accepted", "packed", "dispatched"];

export default async function OrdersPage({ searchParams }: PageProps<"/app/orders">) {
  const { business, role } = await requireBusiness();
  const t = await getTranslations();
  const format = await getFormatter();
  const sp = await searchParams;

  const canBuy = business.type !== "company" && can(role, "orders.place");
  const canSell = isSellerType(business.type) && can(role, "orders.manage");
  const tabs = [...(canBuy ? (["purchases"] as const) : []), ...(canSell ? (["sales"] as const) : [])];
  const tab = tabs.find((x) => x === sp.tab) ?? tabs[0];
  const filter = sp.filter === "all" ? "all" : "open";

  await connectDB();
  const placedGroup = typeof sp.placed === "string" ? sp.placed : null;
  const placedCount = placedGroup ? await Order.countDocuments({ groupId: placedGroup, buyerId: business._id }) : 0;

  const orders = tab
    ? await Order.find({
        [tab === "sales" ? "sellerId" : "buyerId"]: business._id,
        ...(filter === "open" ? { status: { $in: OPEN } } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .select({ orderNo: 1, status: 1, createdAt: 1, buyer: 1, seller: 1, "totals.grandTotal": 1, items: 1, payment: 1 })
        .lean()
    : [];
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const link = (params: Record<string, string>) => `/app/orders?${new URLSearchParams({ tab: tab ?? "", filter, ...params })}`;

  return (
    <>
      <PageHeader title={t("orders.title")} />

      {placedCount ? (
        <div className="mb-5">
          <Alert tone="success" title={t("orders.placedTitle")}>
            {t("orders.placedBody", { count: placedCount })}
          </Alert>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {tabs.length > 1 ? (
          <div className="inline-flex rounded-lg border border-line bg-white p-1">
            {tabs.map((x) => (
              <Link
                key={x}
                href={link({ tab: x })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  x === tab ? "bg-brand-50 text-brand-800" : "text-muted hover:text-ink",
                )}
              >
                {t(`orders.${x}`)}
              </Link>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-2 text-sm">
          {(["open", "all"] as const).map((f) => (
            <Link
              key={f}
              href={link({ filter: f })}
              className={cn(
                "rounded-full border px-3 py-1",
                f === filter ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-muted",
              )}
            >
              {t(`orders.${f}`)}
            </Link>
          ))}
        </div>
      </div>

      <Card>
        {orders.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">{t("orders.empty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((o) => {
              const other = tab === "sales" ? o.buyer : o.seller;
              return (
                <li key={String(o._id)}>
                  <Link
                    href={`/app/orders/${o._id}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-canvas sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{other.name}</p>
                      <p className="text-xs text-muted">
                        {o.orderNo} · {format.dateTime(new Date(o.createdAt), { dateStyle: "medium" })} ·{" "}
                        {t("orders.items", { count: o.items.length })}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{inr(o.totals?.grandTotal ?? 0)}</span>
                      <div className="flex gap-1">
                        {o.payment?.status === "paid" ? <Badge tone="success">{t("orders.paid")}</Badge> : null}
                        <Badge tone={STATUS_TONE[o.status as OrderStatus]}>{t(`orders.statusLabel.${o.status}`)}</Badge>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
