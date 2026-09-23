import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Recall } from "@/lib/models/recall";
import { requirePlatformRole } from "@/lib/session";
import { RecallForm, WithdrawButton } from "./recall-form";

export const metadata = { title: "Recalls" };

export default async function RecallsPage() {
  await requirePlatformRole("admin");
  const t = await getTranslations("admin");
  const format = await getFormatter();
  await connectDB();
  const recalls = await Recall.find().sort({ createdAt: -1 }).limit(100).lean();

  return (
    <>
      <PageHeader title={t("recallsTab")} description={t("recallsHelp")} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <Card className="h-fit">
          <CardHeader title={t("recallsList")} />
          {recalls.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">{t("recallsEmpty")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {recalls.map((r) => (
                <li key={String(r._id)} className="space-y-2 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {r.productName} · <span className="font-mono text-sm">{r.batchNo}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {[r.manufacturer, format.dateTime(new Date(r.createdAt), { dateStyle: "medium" }), r.issuedByName]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={r.severity === "advisory" ? "warning" : "danger"}>
                        {t(`recallSeverityLabel.${r.severity}`)}
                      </Badge>
                      {r.status === "withdrawn" ? <Badge>{t("recallWithdrawn")}</Badge> : null}
                    </div>
                  </div>
                  <p className="text-sm">{r.reason}</p>
                  {r.reference ? <p className="text-xs text-muted">{r.reference}</p> : null}
                  <p className="text-xs text-muted">
                    {t("recallStats", {
                      listings: r.stats?.listings ?? 0,
                      sellers: r.stats?.sellers ?? 0,
                      orders: r.stats?.orders ?? 0,
                      buyers: r.stats?.buyers ?? 0,
                    })}
                  </p>
                  {r.status === "active" ? <WithdrawButton id={String(r._id)} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title={t("recallIssue")} description={t("recallIssueHint")} />
          <RecallForm />
        </Card>
      </div>
    </>
  );
}
