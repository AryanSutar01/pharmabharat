import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { SimpleHeader } from "@/components/simple-header";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { kycChecklist } from "@/lib/kyc";
import { DOCUMENT_KINDS, REQUIRED_DOCUMENTS, type BusinessDoc, type KycStatus } from "@/lib/models/business";
import { can } from "@/lib/permissions";
import { getBusinessContext } from "@/lib/session";
import { CreateBusinessForm } from "./create-business-form";
import { Documents, SubmitForReview, type UploadedDoc } from "./documents";
import { ProfileForm, type ProfileDefaults } from "./profile-form";
import { BusinessSummary } from "@/components/business-summary";

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

export default async function OnboardingPage() {
  const t = await getTranslations();
  const format = await getFormatter();
  const { business, role } = await getBusinessContext();

  if (!business || !role) {
    return (
      <>
        <SimpleHeader />
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <PageHeader title={t("onboarding.title")} description={t("onboarding.createSubtitle")} />
          <Card className="p-4 sm:p-6">
            <CreateBusinessForm />
          </Card>
        </main>
      </>
    );
  }

  const status = (business.kyc?.status ?? "draft") as KycStatus;
  if (status === "approved") redirect("/app");

  const canEdit = can(role, "business.edit");
  const editable = canEdit && (status === "draft" || status === "rejected");
  const check = kycChecklist(business);
  const required = REQUIRED_DOCUMENTS[business.type];
  const optional = DOCUMENT_KINDS.filter((k) => !required.includes(k));
  const docs: UploadedDoc[] = business.documents.map((d) => ({
    id: String(d._id),
    kind: d.kind,
    name: d.originalName || t(`documentKind.${d.kind}`),
  }));

  return (
    <>
      <SimpleHeader />
      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8 sm:px-6">
        <PageHeader
          title={business.tradeName || business.legalName}
          description={t(`businessType.${business.type}`)}
          action={<Badge tone={STATUS_TONE[status]}>{t(`kycStatus.${status}`)}</Badge>}
        />

        {status === "pending" ? (
          <Alert tone="info" title={t("onboarding.pendingTitle")}>
            {t("onboarding.pendingBody")}
            {business.kyc?.submittedAt ? (
              <p className="mt-1 text-xs">
                {t("onboarding.submittedOn", { date: format.dateTime(new Date(business.kyc.submittedAt), { dateStyle: "medium" }) })}
              </p>
            ) : null}
          </Alert>
        ) : null}
        {status === "rejected" ? (
          <Alert tone="warning" title={t("onboarding.rejectedTitle")}>
            {business.kyc?.remarks ? <p className="whitespace-pre-line">{business.kyc.remarks}</p> : t("onboarding.rejectedBody")}
          </Alert>
        ) : null}
        {status === "suspended" ? (
          <Alert tone="danger" title={t("onboarding.suspendedTitle")}>
            {t("onboarding.suspendedBody")}
          </Alert>
        ) : null}
        {!canEdit && status !== "suspended" ? <Alert tone="info">{t("onboarding.staffWaiting")}</Alert> : null}

        {canEdit ? (
          <>
            <Card>
              <CardHeader title={`1. ${t("onboarding.stepDetails")}`} />
              <div className="p-4 sm:p-5">
                {editable ? (
                  <ProfileForm type={business.type} defaults={toDefaults(business)} />
                ) : (
                  <BusinessSummary business={business} />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={`2. ${t("onboarding.stepDocuments")}`} />
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
            </Card>

            {editable ? (
              <Card>
                <CardHeader title={`3. ${t("onboarding.stepSubmit")}`} description={t("onboarding.submitHelp")} />
                <div className="space-y-4 p-4 sm:p-5">
                  <ul className="space-y-1 text-sm">
                    <ChecklistItem done={check.profileComplete} label={t("onboarding.checklistProfile")} />
                    <ChecklistItem done={check.missingDocuments.length === 0} label={t("onboarding.checklistDocs")} />
                  </ul>
                  <SubmitForReview disabled={!check.profileComplete || check.missingDocuments.length > 0} />
                </div>
              </Card>
            ) : null}
          </>
        ) : null}
      </main>
    </>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={
          done
            ? "grid size-5 place-items-center rounded-full bg-brand-600 text-xs text-white"
            : "size-5 rounded-full border-2 border-line"
        }
        aria-hidden
      >
        {done ? "✓" : null}
      </span>
      <span className={done ? "text-ink" : "text-muted"}>{label}</span>
    </li>
  );
}
