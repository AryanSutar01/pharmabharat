import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BusinessSummary } from "@/components/business-summary";
import { Badge, Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Business profile" };

export default async function BusinessPage() {
  const { business, role } = await requireBusiness();
  const t = await getTranslations();

  return (
    <>
      <PageHeader
        title={t("nav.business")}
        description={t(`businessType.${business.type}`)}
        action={
          can(role, "team.manage") ? (
            <Link href="/app/team" className={buttonClass("secondary")}>
              {t("nav.team")}
            </Link>
          ) : null
        }
      />
      <div className="space-y-5">
        <Card>
          <CardHeader
            title={business.tradeName || business.legalName}
            action={<Badge tone="success">{t("kycStatus.approved")}</Badge>}
          />
          <div className="p-4 sm:p-5">
            <BusinessSummary business={business} />
          </div>
        </Card>
        <Card>
          <CardHeader title={t("onboarding.stepDocuments")} />
          <ul className="divide-y divide-line">
            {business.documents.map((d) => (
              <li key={String(d._id)} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <span className="min-w-0">
                  <span className="block font-medium">{t(`documentKind.${d.kind}`)}</span>
                  <span className="block truncate text-xs text-muted">{d.originalName}</span>
                </span>
                <a
                  href={`/api/kyc-documents/${business._id}/${d._id}`}
                  target="_blank"
                  rel="noopener"
                  className="shrink-0 text-brand-700 hover:underline"
                >
                  {t("common.view")}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
