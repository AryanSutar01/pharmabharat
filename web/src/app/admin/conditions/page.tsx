import { getLocale, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Condition } from "@/lib/models/condition";
import { requirePlatformRole } from "@/lib/session";
import { ConditionForm } from "./condition-form";

export const metadata = { title: "Conditions" };

export default async function ConditionsPage() {
  await requirePlatformRole("admin");
  const t = await getTranslations("admin");
  const locale = (await getLocale()) as "en" | "hi" | "mr";
  await connectDB();
  const conditions = await Condition.find().sort({ slug: 1 }).lean();

  return (
    <>
      <PageHeader title={t("conditionsTab")} description={t("conditionsHelp")} />
      <div className="space-y-3">
        {conditions.map((c) => (
          <Card key={c.slug}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0">
                  <span className="font-medium">{c.name?.[locale] || c.name?.en}</span>{" "}
                  <span className="font-mono text-xs text-muted">{c.slug}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge>{t("saltCount", { count: c.salts.length })}</Badge>
                  {c.active ? null : <Badge tone="warning">{t("inactive")}</Badge>}
                  <span className="text-muted group-open:rotate-90" aria-hidden>
                    ›
                  </span>
                </span>
              </summary>
              <div className="border-t border-line p-4 sm:p-5">
                <ConditionForm
                  values={{
                    slug: c.slug,
                    en: c.name?.en ?? "",
                    hi: c.name?.hi ?? "",
                    mr: c.name?.mr ?? "",
                    salts: c.salts,
                    active: c.active ?? true,
                  }}
                />
              </div>
            </details>
          </Card>
        ))}
        <Card>
          <CardHeader title={t("newCondition")} />
          <div className="p-4 sm:p-5">
            <ConditionForm />
          </div>
        </Card>
      </div>
    </>
  );
}
