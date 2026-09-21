import { getTranslations } from "next-intl/server";
import { stateName } from "@/lib/india";
import type { BusinessDoc } from "@/lib/models/business";

export async function BusinessSummary({ business: b }: { business: BusinessDoc }) {
  const t = await getTranslations("onboarding");
  const rows: [string, string | undefined | null][] = [
    [t("legalName"), b.legalName],
    [t("tradeName"), b.tradeName],
    [t("gstin"), b.gstin],
    [t("pan"), b.pan],
    [t("phone"), b.phone],
    [t("email"), b.email],
    [
      t("addressLine1"),
      [b.address?.line1, b.address?.line2, b.address?.city, b.address?.pincode].filter(Boolean).join(", "),
    ],
    [t("licensesTitle"), b.drugLicenses.map((l) => `${l.form}: ${l.number}`).join(" · ")],
    [t("state"), b.address?.stateCode ? stateName(b.address.stateCode) : null],
    ...(b.pharmacist?.name ? [[t("pharmacistTitle"), `${b.pharmacist.name} (${b.pharmacist.registrationNumber})`] as [string, string]] : []),
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted">{k}</dt>
          <dd className="mt-0.5 break-words font-medium">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
