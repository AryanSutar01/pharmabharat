import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, cn } from "@/components/ui";
import { requireShop } from "@/lib/retail/guard";
import { listStock, stockSummary, type StockFilter } from "@/lib/retail/stock";
import { AddStockForm, StockRowControls } from "./stock-controls";

export const metadata = { title: "Shop stock" };

const FILTERS: StockFilter[] = ["all", "expiring", "expired", "out"];

export default async function ShopStockPage({ searchParams }: PageProps<"/app/shop/stock">) {
  const { business } = await requireShop("retail.manage");
  const t = await getTranslations("shop");
  const format = await getFormatter();
  const sp = await searchParams;

  const filter = FILTERS.find((f) => f === sp.filter) ?? "all";
  const q = typeof sp.q === "string" ? sp.q : "";
  const [rows, summary] = await Promise.all([
    listStock(business._id, { filter, q }),
    stockSummary(business._id),
  ]);

  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const monthYear = (d: string) => format.dateTime(new Date(d), { month: "short", year: "numeric" });

  const stats = [
    { label: t("stockValue"), value: inr(summary.value), hint: t("atCost") },
    { label: t("retailValue"), value: inr(summary.retail), hint: t("atMrp") },
    { label: t("batches"), value: String(summary.batches), hint: t("packs", { count: summary.packs }) },
    {
      label: t("expiringSoon"),
      value: String(summary.expiring),
      hint: summary.expired ? t("expiredCount", { count: summary.expired }) : t("within90"),
      danger: summary.expired > 0,
    },
  ];

  return (
    <>
      <PageHeader title={t("stockTitle")} description={t("stockSubtitle")} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className={cn("mt-1 text-xl font-semibold tabular-nums", s.danger && "text-red-600")}>{s.value}</p>
            <p className="mt-0.5 text-xs text-muted">{s.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="h-fit">
          <CardHeader
            title={t("onTheShelf")}
            action={
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <Link
                    key={f}
                    href={`/app/shop/stock?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      f === filter ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-muted",
                    )}
                  >
                    {t(`stockFilter.${f}`)}
                  </Link>
                ))}
              </div>
            }
          />
          <form className="border-b border-line px-4 py-3 sm:px-5" action="/app/shop/stock">
            <input type="hidden" name="filter" value={filter} />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder={t("searchShelf")}
              className="h-10 w-full rounded-lg border border-line bg-white px-3 text-base sm:text-sm"
            />
          </form>

          {rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">{t("stockEmpty")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted">
                      {[r.manufacturer, r.packSizeLabel].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t("batch")} {r.batchNo} · {t("exp")} {monthYear(r.expiryDate)} · {t("mrp")} {inr(r.mrp)} ·{" "}
                      {t("cost")} {inr(r.cost)}
                      {r.supplierName ? ` · ${r.supplierName}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.daysToExpiry <= 0 ? (
                        <Badge tone="danger">{t("expired")}</Badge>
                      ) : r.daysToExpiry <= 90 ? (
                        <Badge tone="warning">{t("expiresInDays", { days: r.daysToExpiry })}</Badge>
                      ) : null}
                      {r.qty === 0 ? <Badge tone="neutral">{t("outOfStock")}</Badge> : null}
                      {r.source === "order" ? <Badge tone="info">{t("fromOrder")}</Badge> : null}
                    </div>
                  </div>
                  <StockRowControls id={r.id} qty={r.qty} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title={t("addStock")} description={t("addStockHint")} />
          <AddStockForm />
        </Card>
      </div>
    </>
  );
}
