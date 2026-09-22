import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { NavIcon } from "@/components/app-nav";
import { BarList } from "@/components/charts/bar-list";
import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/charts/stat-tile";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { buyerDashboard, sellerDashboard } from "@/lib/analytics";
import { isSellerType } from "@/lib/catalog/seller";
import { connectDB } from "@/lib/db/mongo";
import { Banner } from "@/lib/models/banner";
import { can } from "@/lib/permissions";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Home" };

type L = "en" | "hi" | "mr";

async function activeBanners(audience: "retailer" | "wholesaler" | "company") {
  await connectDB();
  const now = new Date();
  return Banner.find({
    active: true,
    audience: { $in: ["all" as const, audience] },
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
}

export default async function Dashboard() {
  const { business, session, role } = await requireBusiness();
  const [t, format, locale, banners] = await Promise.all([getTranslations(), getFormatter(), getLocale(), activeBanners(business.type)]);
  const firstName = session.user.name.split(" ")[0];
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const inrCompact = (v: number) =>
    format.number(v, { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
  const pick = (x?: { en?: string | null; hi?: string | null; mr?: string | null } | null) => x?.[locale as L] || x?.en || "";

  const showAnalytics = can(role, "analytics.view");
  const seller = isSellerType(business.type);

  return (
    <>
      <PageHeader
        title={t("app.welcome", { name: firstName })}
        description={t("app.dashboardSubtitle", { business: business.tradeName || business.legalName })}
        action={<Badge tone="success">✓ {t("app.verified")}</Badge>}
      />

      {banners.length ? (
        <section aria-label={t("dashboard.announcements")} className="mb-5 space-y-2">
          {banners.map((b) => (
            <Alert key={String(b._id)} tone={(b.tone ?? "info") as "info" | "success" | "warning"} title={pick(b.title)}>
              {pick(b.body)}
              {b.link ? (
                <>
                  {" "}
                  <Link href={b.link} className="font-medium underline">
                    →
                  </Link>
                </>
              ) : null}
            </Alert>
          ))}
        </section>
      ) : null}

      {!showAnalytics ? (
        <QuickLinks t={t} />
      ) : seller ? (
        <SellerView businessId={business._id} t={t} inr={inr} inrCompact={inrCompact} />
      ) : business.type === "retailer" ? (
        <BuyerView businessId={business._id} t={t} inr={inr} inrCompact={inrCompact} />
      ) : (
        <>
          <Alert tone="info">{t("dashboard.companyIntro")}</Alert>
          <div className="mt-5">
            <QuickLinks t={t} />
          </div>
        </>
      )}
    </>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;

async function SellerView({
  businessId,
  t,
  inr,
  inrCompact,
}: {
  businessId: Parameters<typeof sellerDashboard>[0];
  t: T;
  inr: (v: number) => string;
  inrCompact: (v: number) => string;
}) {
  const d = await sellerDashboard(businessId);
  const pipeline = ["placed", "accepted", "packed", "dispatched"] as const;
  return (
    <div className="space-y-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("dashboard.last30")}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("dashboard.sales")} value={inrCompact(d.revenue.current)} change={d.revenue.change} changeLabel={t("dashboard.vsPrev")} />
        <StatTile label={t("dashboard.orders")} value={String(d.orders.current)} change={d.orders.change} changeLabel={t("dashboard.vsPrev")} />
        <StatTile label={t("dashboard.avgOrder")} value={inrCompact(d.avgOrder.current)} change={d.avgOrder.change} changeLabel={t("dashboard.vsPrev")} />
        <StatTile label={t("dashboard.expiring")} value={String(d.stock.expiring)} hint={t("dashboard.stockHealth")} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0">
          <CardHeader title={t("dashboard.dailySales")} />
          <div className="p-4 sm:p-5">
            <ColumnChart points={d.daily} title={t("dashboard.dailySales")} tableLabel={t("dashboard.viewTable")} />
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("dashboard.pipeline")} />
            <ul className="divide-y divide-line text-sm">
              {pipeline.map((s) => (
                <li key={s}>
                  <Link href="/app/orders?tab=sales" className="flex items-center justify-between px-4 py-2.5 hover:bg-canvas sm:px-5">
                    <span>{t(`orders.statusLabel.${s}`)}</span>
                    <span className="font-semibold tabular-nums">{d.pipeline[s] ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title={t("dashboard.stockHealth")} />
            <ul className="divide-y divide-line text-sm">
              {[
                { label: t("dashboard.activeListings"), value: d.stock.active, href: "/app/inventory" },
                { label: t("dashboard.lowStock"), value: d.stock.low, href: "/app/inventory" },
                { label: t("dashboard.outOfStock"), value: d.stock.out, href: "/app/inventory" },
                { label: t("dashboard.expiring"), value: d.stock.expiring, href: "/app/inventory?filter=expiring" },
              ].map((r) => (
                <li key={r.label}>
                  <Link href={r.href} className="flex items-center justify-between px-4 py-2.5 hover:bg-canvas sm:px-5">
                    <span>{r.label}</span>
                    <span className="font-semibold tabular-nums">{r.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title={t("dashboard.topProducts")} />
        <div className="p-4 sm:p-5">
          <BarList
            items={d.topProducts}
            formatValue={inr}
            sublabel={(i) => t("dashboard.units", { count: i.sublabel ?? "0" })}
            href={(i) => `/app/catalog/${i.id}`}
            empty={t("dashboard.noData")}
          />
        </div>
      </Card>
    </div>
  );
}

async function BuyerView({
  businessId,
  t,
  inr,
  inrCompact,
}: {
  businessId: Parameters<typeof buyerDashboard>[0];
  t: T;
  inr: (v: number) => string;
  inrCompact: (v: number) => string;
}) {
  const d = await buyerDashboard(businessId);
  return (
    <div className="space-y-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("dashboard.last30")}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Spending more or less is neither good nor bad, so the change stays grey. */}
        <StatTile label={t("dashboard.spend")} value={inrCompact(d.spend.current)} change={d.spend.change} changeLabel={t("dashboard.vsPrev")} neutral />
        <StatTile label={t("dashboard.orders")} value={String(d.orders.current)} change={d.orders.change} changeLabel={t("dashboard.vsPrev")} />
        <StatTile label={t("dashboard.saved")} value={inrCompact(d.saved)} hint={t("dashboard.savedHint", { pct: d.savedPct })} />
        <StatTile label={t("dashboard.openOrders")} value={String(d.openOrders)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0">
          <CardHeader title={t("dashboard.dailySpend")} />
          <div className="p-4 sm:p-5">
            <ColumnChart points={d.daily} title={t("dashboard.dailySpend")} tableLabel={t("dashboard.viewTable")} />
          </div>
        </Card>
        <Card className="h-fit">
          <CardHeader title={t("dashboard.topSuppliers")} />
          <div className="p-4 sm:p-5">
            <BarList
              items={d.topSuppliers}
              formatValue={inr}
              sublabel={(i) => t("dashboard.ordersCount", { count: Number(i.sublabel ?? 0) })}
              empty={t("dashboard.noData")}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuickLinks({ t }: { t: T }) {
  const tiles = [
    { href: "/app/catalog", label: t("nav.catalog"), icon: "catalog" as const },
    { href: "/app/orders", label: t("nav.orders"), icon: "orders" as const },
    { href: "/app/chat", label: t("nav.chat"), icon: "chat" as const },
    { href: "/app/support", label: t("nav.support"), icon: "help" as const },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <Link key={tile.href} href={tile.href}>
          <Card className="flex flex-col items-start gap-3 p-4 transition-colors hover:border-brand-200">
            <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
              <NavIcon name={tile.icon} />
            </span>
            <span className="text-sm font-medium">{tile.label}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
