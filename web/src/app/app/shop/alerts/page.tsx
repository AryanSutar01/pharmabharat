import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, buttonClass, cn } from "@/components/ui";
import { expiringStock, lowStock, SHOP_EXPIRY_LEVELS } from "@/lib/retail/alerts";
import { requireShop } from "@/lib/retail/guard";
import { ReorderLevel } from "./reorder-level";

export const metadata = { title: "Shop alerts" };

export default async function ShopAlertsPage({ searchParams }: PageProps<"/app/shop/alerts">) {
  const { business } = await requireShop("retail.manage");
  const t = await getTranslations("shop");
  const format = await getFormatter();
  const sp = await searchParams;
  const tab = sp.tab === "low" ? "low" : "expiry";

  const [expiring, low] = await Promise.all([expiringStock(business._id), lowStock(business._id)]);
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const day = (d: string) => format.dateTime(new Date(d), { month: "short", year: "numeric" });

  const expired = expiring.filter((r) => r.bucket === "expired");
  const atRisk = expiring.reduce((a, r) => a + r.value, 0);
  const buckets = SHOP_EXPIRY_LEVELS.map((level) => ({
    level,
    rows: expiring.filter((r) => r.bucket === level),
  }));

  return (
    <>
      <PageHeader title={t("alertsTitle")} description={t("alertsSubtitle")} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">{t("valueAtRisk")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{inr(atRisk)}</p>
          <p className="mt-0.5 text-xs text-muted">{t("within90")}</p>
        </Card>
        {SHOP_EXPIRY_LEVELS.map((level) => (
          <Card key={level} className="p-4">
            <p className="text-xs text-muted">{t("expiringWithin", { days: level })}</p>
            <p className={cn("mt-1 text-xl font-semibold tabular-nums", level === 30 && "text-red-600")}>
              {expiring.filter((r) => r.bucket === level).length}
            </p>
            <p className="mt-0.5 text-xs text-muted">{t("batches")}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-line bg-white p-1">
        {(["expiry", "low"] as const).map((x) => (
          <Link
            key={x}
            href={`/app/shop/alerts?tab=${x}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              x === tab ? "bg-brand-50 text-brand-800" : "text-muted hover:text-ink",
            )}
          >
            {x === "expiry" ? t("expiryTab") : t("lowStockTab", { count: low.length })}
          </Link>
        ))}
      </div>

      {tab === "expiry" ? (
        <div className="space-y-5">
          {expired.length ? (
            <Card className="border-red-200">
              <CardHeader title={t("expiredTitle", { count: expired.length })} description={t("expiredHint")} />
              <ul className="divide-y divide-line">
                {expired.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{r.name}</span>
                      <span className="block text-xs text-muted">
                        {t("batch")} {r.batchNo} · {day(r.expiryDate)} · {r.qty} {t("packsShort")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-red-600">{inr(r.value)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {buckets.map(({ level, rows }) =>
            rows.length ? (
              <Card key={level}>
                <CardHeader
                  title={t("expiringWithin", { days: level })}
                  description={t("batchesWorth", { count: rows.length, value: inr(rows.reduce((a, r) => a + r.value, 0)) })}
                />
                <ul className="divide-y divide-line">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{r.name}</span>
                        <span className="block text-xs text-muted">
                          {t("batch")} {r.batchNo} · {day(r.expiryDate)} · {r.qty} {t("packsShort")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <Badge tone={level === 30 ? "danger" : "warning"}>{t("daysLeft", { days: r.daysLeft })}</Badge>
                        <span className="mt-0.5 block text-xs tabular-nums text-muted">{inr(r.value)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null,
          )}

          {expiring.length === 0 ? (
            <Card>
              <p className="px-4 py-12 text-center text-sm text-muted">{t("noExpiring")}</p>
            </Card>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardHeader
            title={t("lowStockTitle")}
            description={t("lowStockHint")}
            action={
              low.length ? (
                <Link href="/app/cart/quick?lowstock=1" className={buttonClass("primary")}>
                  {t("orderThese")}
                </Link>
              ) : null
            }
          />
          {low.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">{t("noLowStock")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {low.map((r) => (
                <li key={r.productId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted">
                      {t("onShelf", { count: r.inStock })} ·{" "}
                      {r.daysLeft === null
                        ? t("noRecentSales")
                        : t("daysOfCover", { days: r.daysLeft, rate: r.dailySales })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-right text-xs text-muted">
                      {t("suggestOrder")}
                      <b className="ml-1 text-sm text-ink tabular-nums">{r.suggestedQty}</b>
                    </span>
                    <ReorderLevel productId={r.productId} level={r.reorderLevel} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
