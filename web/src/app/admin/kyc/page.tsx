import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, PageHeader, cn } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Business, KYC_STATUSES, type KycStatus } from "@/lib/models/business";
import { stateName } from "@/lib/india";
import { requirePlatformRole } from "@/lib/session";

export const metadata = { title: "Verification queue" };

const TONE = { draft: "neutral", pending: "info", approved: "success", rejected: "warning", suspended: "danger" } as const;

export default async function KycQueue({ searchParams }: PageProps<"/admin/kyc">) {
  await requirePlatformRole("admin");
  const t = await getTranslations();
  const format = await getFormatter();
  const sp = await searchParams;
  const status = (KYC_STATUSES as readonly string[]).includes(sp.status as string) ? (sp.status as KycStatus) : "pending";

  await connectDB();
  const [rows, counts] = await Promise.all([
    Business.find({ "kyc.status": status })
      .sort({ "kyc.submittedAt": 1, createdAt: -1 })
      .limit(100)
      .select({ legalName: 1, tradeName: 1, type: 1, gstin: 1, address: 1, kyc: 1, createdAt: 1 })
      .lean(),
    Business.aggregate<{ _id: KycStatus; n: number }>([{ $group: { _id: "$kyc.status", n: { $sum: 1 } } }]),
  ]);
  const count = new Map(counts.map((c) => [c._id, c.n]));

  return (
    <>
      <PageHeader title={t("admin.kycQueue")} description={t("admin.kycQueueSubtitle")} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {KYC_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/kyc?status=${s}`}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-sm",
              s === status ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-muted hover:text-ink",
            )}
          >
            {t(`kycStatus.${s}`)} <span className="ml-1 text-xs">{count.get(s) ?? 0}</span>
          </Link>
        ))}
      </div>

      <Card>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">{t("admin.empty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((b) => (
              <li key={String(b._id)}>
                <Link
                  href={`/admin/kyc/${b._id}`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-canvas sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.tradeName || b.legalName}</p>
                    <p className="truncate text-xs text-muted">
                      {t(`businessType.${b.type}`)}
                      {b.gstin ? ` · ${b.gstin}` : ""}
                      {b.address?.stateCode ? ` · ${b.address.city}, ${stateName(b.address.stateCode)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
                    {b.kyc?.submittedAt ? format.dateTime(new Date(b.kyc.submittedAt), { dateStyle: "medium" }) : null}
                    <Badge tone={TONE[b.kyc?.status as KycStatus]}>{t(`kycStatus.${b.kyc?.status ?? "draft"}`)}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
