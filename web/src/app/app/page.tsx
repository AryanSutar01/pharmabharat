import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NavIcon } from "@/components/app-nav";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Home" };

export default async function Dashboard() {
  const { business, session } = await requireBusiness();
  const t = await getTranslations();
  const firstName = session.user.name.split(" ")[0];

  const tiles = [
    { href: "/app/catalog", label: t("nav.catalog"), icon: "catalog" as const },
    { href: "/app/orders", label: t("nav.orders"), icon: "orders" as const },
    { href: "/app/chat", label: t("nav.chat"), icon: "chat" as const },
    { href: "/app/business", label: t("nav.business"), icon: "business" as const },
  ];

  return (
    <>
      <PageHeader
        title={t("app.welcome", { name: firstName })}
        description={t("app.dashboardSubtitle", { business: business.tradeName || business.legalName })}
        action={<Badge tone="success">✓ {t("app.verified")}</Badge>}
      />
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
      <div className="mt-6">
        <Alert tone="info" title={t("app.nextStepsTitle")}>
          {t("app.nextSteps")}
        </Alert>
      </div>
    </>
  );
}
