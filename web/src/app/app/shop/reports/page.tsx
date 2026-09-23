import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { BarList } from "@/components/charts/bar-list";
import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/charts/stat-tile";
import { Card, CardHeader, PageHeader, cn } from "@/components/ui";
import { requireShop } from "@/lib/retail/guard";
import { DEAD_STOCK_DAYS, shopReport } from "@/lib/retail/reports";

export const metadata = { title: "Shop reports" };

const RANGES = [30, 90, 365] as const;

export default async function ShopReportsPage({ searchParams }: PageProps<"/app/shop/reports">) {
  const { business } = await requireShop("retail.manage");
  const t = await getTranslations("shop");
  const format = await getFormatter();
  const sp = await searchParams;

  const days = RANGES.find((r) => String(r) === sp.days) ?? 30;
  const report = await shopReport(business._id, new Date(), days);
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const inr2 = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const gstTotal = report.gst.reduce((a, r) => a + r.cgst + r.sgst, 0);

  return (
    <>
      <PageHeader
        title={t("reportsTitle")}
        description={t("reportsSubtitle", { days })}
        action={
          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/app/shop/reports?days=${r}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  r === days ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-muted",
                )}
              >
                {t("lastDays", { days: r })}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("sales")}
          value={inr(report.sales.current)}
          change={report.sales.change}
          changeLabel={t("vsPrevious")}
        />
        <StatTile
          label={t("margin")}
          value={inr(report.margin.current)}
          change={report.margin.change}
          changeLabel={t("vsPrevious")}
          hint={t("marginPercent", { percent: report.marginPercent })}
        />
        <StatTile label={t("billsCount")} value={String(report.bills.current)} change={report.bills.change} changeLabel={t("vsPrevious")} />
        <StatTile
          label={t("averageBillValue")}
          value={inr(report.averageBill.current)}
          change={report.averageBill.change}
          changeLabel={t("vsPrevious")}
        />
      </div>

      <div className="mb-5">
        <Card className="p-4 sm:p-5">
          <ColumnChart
            points={report.daily}
            title={t("dailySales")}
            tableLabel={t("viewAsTable")}
            emptyText={t("noSalesYet")}
          />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("topSellers")} description={t("topSellersHint")} />
          <div className="p-4 sm:p-5">
            <BarList
              items={report.topSellers}
              formatValue={inr}
              sublabel={(i) => t("packsSold", { count: Number(i.sublabel ?? 0) })}
              href={(i) => `/app/catalog/${i.id}`}
              empty={t("noSalesYet")}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title={t("topMargin")} description={t("topMarginHint")} />
          <div className="p-4 sm:p-5">
            <BarList items={report.topMargin} formatValue={inr} href={(i) => `/app/catalog/${i.id}`} empty={t("noSalesYet")} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t("deadStock")}
            description={t("deadStockHint", { days: DEAD_STOCK_DAYS, value: inr(report.deadStockValue) })}
          />
          {report.deadStock.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">{t("noDeadStock")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {report.deadStock.map((d) => (
                <li key={d.productId} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0 text-sm">{d.name}</span>
                  <span className="shrink-0 text-right text-xs text-muted">
                    <b className="block text-sm tabular-nums text-ink">{inr(d.value)}</b>
                    {t("packsShort")} {d.qty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={t("customersReport")} description={t("customersReportHint")} />
          <div className="grid grid-cols-3 gap-3 px-4 pt-4 sm:px-5">
            <div>
              <p className="text-xs text-muted">{t("newCustomers")}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{report.customers.newCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{t("repeatCustomers")}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{report.customers.repeatCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{t("lapsedCustomers")}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{report.customers.lapsed}</p>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <BarList
              items={report.customers.top}
              formatValue={inr}
              sublabel={(i) => t("visits", { count: Number(i.sublabel ?? 0) })}
              href={(i) => `/app/shop/customers/${i.id}`}
              empty={t("noCustomerSales")}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title={t("expiryLoss")} description={t("expiryLossHint")} />
          <div className="p-4 sm:p-5">
            <p className="text-2xl font-semibold tabular-nums">{inr(report.expiryLoss.value)}</p>
            <p className="mt-1 text-sm text-muted">{t("expiredBatches", { count: report.expiryLoss.count })}</p>
            <Link href="/app/shop/alerts" className="mt-3 inline-block text-sm text-brand-700 hover:underline">
              {t("alertsTitle")} →
            </Link>
          </div>
        </Card>

        <Card className="overflow-x-auto">
          <CardHeader title={t("gstSummary")} description={t("gstSummaryHint")} />
          {report.gst.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">{t("noSalesYet")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 sm:px-5">{t("gstRate")}</th>
                  <th className="px-2 py-2 text-right">{t("taxable")}</th>
                  <th className="px-2 py-2 text-right">{t("cgst")}</th>
                  <th className="px-4 py-2 text-right sm:px-5">{t("sgst")}</th>
                </tr>
              </thead>
              <tbody>
                {report.gst.map((r) => (
                  <tr key={r.rate} className="border-b border-line/60">
                    <td className="px-4 py-2 sm:px-5">{r.rate}%</td>
                    <td className="px-2 py-2 text-right tabular-nums">{inr2(r.taxable)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{inr2(r.cgst)}</td>
                    <td className="px-4 py-2 text-right tabular-nums sm:px-5">{inr2(r.sgst)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-4 py-2 sm:px-5">{t("totalTax")}</td>
                  <td />
                  <td colSpan={2} className="px-4 py-2 text-right tabular-nums sm:px-5">
                    {inr2(gstTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
