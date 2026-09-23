import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { BusinessSummary } from "@/components/business-summary";
import { SimpleHeader } from "@/components/simple-header";
import { Alert, Badge, Card, CardHeader, PageHeader, buttonClass, cn } from "@/components/ui";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { kycChecklist } from "@/lib/kyc";
import { DOCUMENT_KINDS, REQUIRED_DOCUMENTS, type BusinessDoc, type KycStatus } from "@/lib/models/business";
import { can } from "@/lib/permissions";
import { getBusinessContext } from "@/lib/session";
import { CreateBusinessForm } from "./create-business-form";
import { Documents, SubmitForReview, type UploadedDoc } from "./documents";
import { OnboardingProgress } from "./onboarding-progress";
import { ProfileForm, type ProfileDefaults } from "./profile-form";

export const metadata = { title: "Onboarding" };

const STATUS_TONE: Record<KycStatus, "neutral" | "warning" | "success" | "danger" | "info"> = {
  draft: "neutral",
  pending: "info",
  approved: "success",
  rejected: "warning",
  suspended: "danger",
};

function toDefaults(b: BusinessDoc): ProfileDefaults {
  return {
    legalName: b.legalName ?? "",
    tradeName: b.tradeName ?? "",
    gstin: b.gstin ?? "",
    pan: b.pan ?? "",
    phone: b.phone ?? "",
    email: b.email ?? "",
    address: {
      line1: b.address?.line1 ?? "",
      line2: b.address?.line2 ?? "",
      city: b.address?.city ?? "",
      district: b.address?.district ?? "",
      stateCode: b.address?.stateCode ?? "",
      pincode: b.address?.pincode ?? "",
    },
    drugLicenses: b.drugLicenses.map((l) => ({
      form: l.form,
      number: l.number,
      validTill: l.validTill ? new Date(l.validTill).toISOString().slice(0, 10) : "",
    })),
    pharmacist: { name: b.pharmacist?.name ?? "", registrationNumber: b.pharmacist?.registrationNumber ?? "" },
    fssaiNumber: b.fssaiNumber ?? "",
  };
}

/**
 * Onboarding in 3 steps: ① business details → ② documents → ③ review & submit.
 * Opens at the first incomplete step; you can go back but not skip ahead.
 */
export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const t = await getTranslations();
  const format = await getFormatter();
  const { business, role } = await getBusinessContext();
  const requested = Number((await searchParams).step) || 0;

  const status = (business?.kyc?.status ?? "draft") as KycStatus;
  if (status === "approved") redirect("/app");

  const check = business ? kycChecklist(business) : { profileComplete: false, missingDocuments: ["x"] };
  const detailsDone = Boolean(business) && check.profileComplete;
  const docsDone = Boolean(business) && check.missingDocuments.length === 0;
  const submitted = status === "pending" || status === "suspended";
  const firstIncomplete = !detailsDone ? 1 : !docsDone ? 2 : 3;
  const step = submitted ? 3 : Math.min(Math.max(requested || firstIncomplete, 1), firstIncomplete);

  const canEdit = !business || (role !== null && can(role, "business.edit"));
  const editable = canEdit && (status === "draft" || status === "rejected");

  const steps = [
    { label: t("onboarding.stepDetails"), done: detailsDone, reachable: !submitted },
    { label: t("onboarding.stepDocuments"), done: docsDone, reachable: !submitted && detailsDone },
    { label: submitted ? t("onboarding.submittedStep") : t("onboarding.reviewTitle"), done: submitted, reachable: !submitted && detailsDone && docsDone },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const required = business ? REQUIRED_DOCUMENTS[business.type] : [];
  const optional = DOCUMENT_KINDS.filter((k) => !required.includes(k));
  const docs: UploadedDoc[] = (business?.documents ?? []).map((d) => ({
    id: String(d._id),
    kind: d.kind,
    name: d.originalName || t(`documentKind.${d.kind}`),
  }));

  return (
    <>
      <SimpleHeader />
      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6">
        <PageHeader
          title={business ? business.tradeName || business.legalName : t("onboarding.title")}
          description={business ? t(`businessType.${business.type}`) : t("onboarding.createSubtitle")}
          action={business ? <Badge tone={STATUS_TONE[status]}>{t(`kycStatus.${status}`)}</Badge> : null}
        />

        {canEdit ? (
          <OnboardingProgress
            steps={steps}
            current={step}
            stepOfLabel={t("onboarding.stepOf", { current: step })}
            doneLabel={t("onboarding.progressDone", { done: doneCount })}
          />
        ) : null}

        {status === "rejected" ? (
          <Alert tone="warning" title={t("onboarding.rejectedTitle")}>
            {business?.kyc?.remarks ? <p className="whitespace-pre-line">{business.kyc.remarks}</p> : t("onboarding.rejectedBody")}
          </Alert>
        ) : null}
        {status === "suspended" ? (
          <Alert tone="danger" title={t("onboarding.suspendedTitle")}>
            {t("onboarding.suspendedBody")}
          </Alert>
        ) : null}

        {!canEdit ? (
          <Alert tone="info">{t("onboarding.staffWaiting")}</Alert>
        ) : submitted ? (
          <>
            {status === "pending" ? (
              <Alert tone="info" title={t("onboarding.pendingTitle")}>
                {t("onboarding.pendingBody")}
                {business?.kyc?.submittedAt ? (
                  <p className="mt-1 text-xs">
                    {t("onboarding.submittedOn", {
                      date: format.dateTime(new Date(business.kyc.submittedAt), { dateStyle: "medium" }),
                    })}
                  </p>
                ) : null}
              </Alert>
            ) : null}
            {business ? <ReviewCard business={business} docs={docs} editable={false} t={t} /> : null}
          </>
        ) : step === 1 ? (
          <Card>
            <CardHeader
              title={`1. ${t("onboarding.stepDetails")}`}
              description={business ? t("onboarding.stepDetailsHint") : t("onboarding.createFirst")}
            />
            <div className="p-4 sm:p-5">
              {business ? (
                <ProfileForm type={business.type} defaults={toDefaults(business)} nextHref="/onboarding?step=2" />
              ) : (
                <CreateBusinessForm />
              )}
            </div>
          </Card>
        ) : step === 2 && business ? (
          <Card>
            <CardHeader title={`2. ${t("onboarding.stepDocuments")}`} description={t("onboarding.stepDocumentsHint")} />
            <div className="p-4 sm:p-5">
              <Documents
                businessId={String(business._id)}
                required={required}
                optional={optional}
                docs={docs}
                editable={editable}
                configured={cloudinaryConfigured()}
              />
            </div>
            <StepNav
              back="/onboarding?step=1"
              next={docsDone ? "/onboarding?step=3" : null}
              backLabel={t("onboarding.back")}
              nextLabel={`${t("onboarding.next")} →`}
            />
          </Card>
        ) : business ? (
          <>
            <ReviewCard business={business} docs={docs} editable={editable} t={t} />
            <Card>
              <CardHeader title={`3. ${t("onboarding.reviewTitle")}`} description={t("onboarding.stepReviewHint")} />
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <Link href="/onboarding?step=2" className={buttonClass("secondary")}>
                  ← {t("onboarding.back")}
                </Link>
                <SubmitForReview disabled={!detailsDone || !docsDone || !editable} />
              </div>
            </Card>
          </>
        ) : null}
      </main>
    </>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;

function StepNav({ back, next, backLabel, nextLabel }: { back: string; next: string | null; backLabel: string; nextLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
      <Link href={back} className={buttonClass("secondary")}>
        ← {backLabel}
      </Link>
      {next ? (
        <Link href={next} className={buttonClass("primary")}>
          {nextLabel}
        </Link>
      ) : (
        <span className={cn(buttonClass("primary"), "pointer-events-none opacity-50")} aria-disabled>
          {nextLabel}
        </span>
      )}
    </div>
  );
}

/** Read-only summary used on the review step and after submission. */
function ReviewCard({ business, docs, editable, t }: { business: BusinessDoc; docs: UploadedDoc[]; editable: boolean; t: T }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={t("onboarding.stepDetails")}
          action={
            editable ? (
              <Link href="/onboarding?step=1" className="text-sm text-brand-700 hover:underline">
                {t("onboarding.edit")}
              </Link>
            ) : null
          }
        />
        <div className="p-4 sm:p-5">
          <BusinessSummary business={business} />
        </div>
      </Card>
      <Card>
        <CardHeader
          title={t("onboarding.stepDocuments")}
          action={
            editable ? (
              <Link href="/onboarding?step=2" className="text-sm text-brand-700 hover:underline">
                {t("onboarding.edit")}
              </Link>
            ) : null
          }
        />
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
              <span className="min-w-0">
                <span className="block font-medium">{t(`documentKind.${d.kind}`)}</span>
                <span className="block truncate text-xs text-muted">{d.name}</span>
              </span>
              <a href={`/api/kyc-documents/${business._id}/${d.id}`} target="_blank" rel="noopener" className="shrink-0 text-brand-700 hover:underline">
                {t("common.view")}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
