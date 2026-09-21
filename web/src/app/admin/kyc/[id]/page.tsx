import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { getFormatter, getTranslations } from "next-intl/server";
import { BusinessSummary } from "@/components/business-summary";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Business, REQUIRED_DOCUMENTS, type KycStatus } from "@/lib/models/business";
import { Membership } from "@/lib/models/membership";
import { requirePlatformRole } from "@/lib/session";
import { getUsersByIds } from "@/lib/users";
import { DecisionForm } from "./decision-form";

export const metadata = { title: "Review business" };

const TONE = { draft: "neutral", pending: "info", approved: "success", rejected: "warning", suspended: "danger" } as const;

export default async function ReviewPage({ params }: PageProps<"/admin/kyc/[id]">) {
  await requirePlatformRole("admin");
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  const t = await getTranslations();
  const format = await getFormatter();

  await connectDB();
  const business = await Business.findById(id).lean();
  if (!business) notFound();
  const members = await Membership.find({ businessId: business._id }).lean();
  const users = await getUsersByIds(members.map((m) => m.userId));
  const owner = users.get(business.ownerUserId);
  const status = (business.kyc?.status ?? "draft") as KycStatus;
  const required = REQUIRED_DOCUMENTS[business.type];
  const uploaded = new Set(business.documents.map((d) => d.kind));

  return (
    <>
      <Link href={`/admin/kyc?status=${status}`} className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← {t("common.back")}
      </Link>
      <PageHeader
        title={business.tradeName || business.legalName}
        description={`${t(`businessType.${business.type}`)} · ${t("admin.owner")}: ${owner?.name ?? "—"} (${owner?.email ?? "—"})`}
        action={<Badge tone={TONE[status]}>{t(`kycStatus.${status}`)}</Badge>}
      />

      {business.kyc?.remarks ? (
        <div className="mb-5">
          <Alert tone="warning" title={t("admin.remarks")}>
            <p className="whitespace-pre-line">{business.kyc.remarks}</p>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title={t("admin.details")}
              action={
                business.gstin ? (
                  <a
                    href="https://services.gst.gov.in/services/searchtp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm text-brand-700 hover:underline"
                  >
                    {t("admin.gstCheck")} ↗
                  </a>
                ) : null
              }
            />
            <div className="p-4 sm:p-5">
              <BusinessSummary business={business} />
              {business.drugLicenses.length ? (
                <ul className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
                  {business.drugLicenses.map((l, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2">
                      <span className="font-mono">
                        {l.form} · {l.number}
                      </span>
                      <span className="text-muted">
                        {t("onboarding.licenseValidTill")}: {format.dateTime(new Date(l.validTill), { dateStyle: "medium" })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title={t("admin.documents")} />
            <ul className="divide-y divide-line">
              {required
                .filter((k) => !uploaded.has(k))
                .map((k) => (
                  <li key={k} className="flex items-center justify-between px-4 py-3 text-sm sm:px-5">
                    <span>{t(`documentKind.${k}`)}</span>
                    <Badge tone="danger">✕</Badge>
                  </li>
                ))}
              {business.documents.map((d) => (
                <li key={String(d._id)} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                  <span className="min-w-0">
                    <span className="block font-medium">{t(`documentKind.${d.kind}`)}</span>
                    <span className="block truncate text-xs text-muted">
                      {d.originalName} · {d.format?.toUpperCase()} · {Math.round((d.bytes ?? 0) / 1024)} KB
                    </span>
                  </span>
                  <a
                    href={`/api/kyc-documents/${business._id}/${d._id}`}
                    target="_blank"
                    rel="noopener"
                    className="shrink-0 text-brand-700 hover:underline"
                  >
                    {t("common.view")} ↗
                  </a>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t("admin.users")} />
            <ul className="divide-y divide-line">
              {members.map((m) => {
                const u = users.get(m.userId);
                return (
                  <li key={String(m._id)} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                    <span className="min-w-0 truncate">
                      {u?.name} <span className="text-muted">· {u?.email}</span>
                    </span>
                    <Badge>{t(`role.${m.role}`)}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-28">
          <CardHeader title={t("admin.review")} />
          <div className="p-4 sm:p-5">
            <DecisionForm businessId={String(business._id)} status={status} />
          </div>
        </Card>
      </div>
    </>
  );
}
