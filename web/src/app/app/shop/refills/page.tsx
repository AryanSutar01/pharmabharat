import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, buttonClass, cn } from "@/components/ui";
import { requireShop } from "@/lib/retail/guard";
import { dueRefills } from "@/lib/retail/refills";
import { ContactedButton } from "./contacted-button";

export const metadata = { title: "Refills due" };

export default async function RefillsPage({ searchParams }: PageProps<"/app/shop/refills">) {
  const { business } = await requireShop("retail.sell");
  const t = await getTranslations("shop");
  const format = await getFormatter();
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "open";

  const all = await dueRefills(business._id);
  const rows = all.filter((r) => (tab === "done" ? r.contactedAt || r.emailedAt : !r.contactedAt && !r.emailedAt));
  const toCall = all.filter((r) => !r.reminders && !r.contactedAt).length;
  const outOfStock = [...new Set(all.filter((r) => r.inStock === 0).map((r) => r.productId))];

  const day = (d: string) => format.dateTime(new Date(d), { dateStyle: "medium" });

  return (
    <>
      <PageHeader title={t("refillsTitle")} description={t("refillsSubtitle")} />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted">{t("refillsDue")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{all.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("refillsToCall")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{toCall}</p>
          <p className="mt-0.5 text-xs text-muted">{t("refillsNoEmail")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("refillsOutOfStock")}</p>
          <p className={cn("mt-1 text-xl font-semibold tabular-nums", outOfStock.length > 0 && "text-red-600")}>
            {outOfStock.length}
          </p>
          {outOfStock.length ? (
            <Link href="/app/cart/quick?lowstock=1" className="mt-1 block text-xs text-brand-700 hover:underline">
              {t("orderThese")} →
            </Link>
          ) : null}
        </Card>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-line bg-white p-1">
        {(["open", "done"] as const).map((x) => (
          <Link
            key={x}
            href={`/app/shop/refills?tab=${x}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              x === tab ? "bg-brand-50 text-brand-800" : "text-muted hover:text-ink",
            )}
          >
            {x === "open" ? t("refillsOpen") : t("refillsHandled")}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title={t("refillsList")} description={t("refillsListHint")} />
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">{t("refillsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li
                key={`${r.customerId}-${r.productId}-${r.dueOn}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <Link href={`/app/shop/customers/${r.customerId}`} className="hover:underline">
                      {r.customerName}
                    </Link>
                    {r.phone ? <span className="ml-2 text-sm font-normal text-muted">{r.phone}</span> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {r.productName} · {t("everyDays", { days: r.gapDays })} · {t("lastBought", { date: day(r.lastBoughtAt) })}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.daysLate > 0 ? (
                      <Badge tone="warning">{t("refillLate", { days: r.daysLate })}</Badge>
                    ) : (
                      <Badge tone="neutral">{t("refillDueOn", { date: day(r.dueAt) })}</Badge>
                    )}
                    {r.inStock === 0 ? <Badge tone="danger">{t("notOnShelfShort")}</Badge> : null}
                    {r.emailedAt ? <Badge tone="success">{t("emailed", { date: day(r.emailedAt) })}</Badge> : null}
                    {r.contactedAt ? <Badge tone="success">{t("called", { date: day(r.contactedAt) })}</Badge> : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.phone ? (
                    <a href={`tel:${r.phone}`} className={buttonClass("secondary", "px-3 py-1.5 text-xs")}>
                      {t("call")}
                    </a>
                  ) : null}
                  {!r.contactedAt ? (
                    <ContactedButton customerId={r.customerId} productId={r.productId} dueOn={r.dueOn} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
