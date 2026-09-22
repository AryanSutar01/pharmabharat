import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/charts/stat-tile";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { platformOverview } from "@/lib/analytics";
import { BUSINESS_TYPES } from "@/lib/permissions";
import { requirePlatformRole } from "@/lib/session";

export const metadata = { title: "Admin" };

export default async function AdminOverview() {
  await requirePlatformRole("admin");
  const [t, format, d] = await Promise.all([getTranslations(), getFormatter(), platformOverview()]);
  const compact = (v: number) => format.number(v, { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

  return (
    <>
      <PageHeader title={t("admin.overview")} description={t("dashboard.last30")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("admin.gmv")} value={compact(d.gmv.current)} change={d.gmv.change} changeLabel={t("dashboard.vsPrev")} />
        <StatTile label={t("admin.platformOrders")} value={String(d.orders.current)} change={d.orders.change} changeLabel={t("dashboard.vsPrev")} />
        <StatTile label={t("admin.totalUsers")} value={String(d.users)} />
        <StatTile label={t("admin.openTickets")} value={String(d.openTickets)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0">
          <CardHeader title={t("admin.dailyGmv")} />
          <div className="p-4 sm:p-5">
            <ColumnChart points={d.daily} title={t("admin.dailyGmv")} tableLabel={t("dashboard.viewTable")} emptyText={t("dashboard.noData")} />
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("admin.verifiedBusinesses")} />
            <ul className="divide-y divide-line text-sm">
              {BUSINESS_TYPES.map((type) => (
                <li key={type} className="flex justify-between px-4 py-2.5 sm:px-5">
                  <span>{t(`businessType.${type}`)}</span>
                  <span className="font-semibold tabular-nums">{d.verifiedByType[type] ?? 0}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <ul className="divide-y divide-line text-sm">
              <li>
                <Link href="/admin/kyc?status=pending" className="flex justify-between px-4 py-2.5 hover:bg-canvas sm:px-5">
                  <span>{t("admin.pendingKyc")}</span>
                  <span className="font-semibold tabular-nums">{d.businessesByStatus.pending ?? 0}</span>
                </Link>
              </li>
              <li>
                <Link href="/admin/reports" className="flex justify-between px-4 py-2.5 hover:bg-canvas sm:px-5">
                  <span>{t("admin.reportedMessages")}</span>
                  <span className="font-semibold tabular-nums">{d.reported}</span>
                </Link>
              </li>
              <li>
                <Link href="/support-desk" className="flex justify-between px-4 py-2.5 hover:bg-canvas sm:px-5">
                  <span>{t("admin.openTickets")}</span>
                  <span className="font-semibold tabular-nums">{d.openTickets}</span>
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
