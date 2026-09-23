import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, cn } from "@/components/ui";
import { customerStats, listCustomers, type CustomerFilter } from "@/lib/retail/customers";
import { requireShop } from "@/lib/retail/guard";
import { CustomerForm } from "./customer-forms";

export const metadata = { title: "Customers" };

const FILTERS: CustomerFilter[] = ["all", "chronic", "reminders", "lapsed"];

export default async function CustomersPage({ searchParams }: PageProps<"/app/shop/customers">) {
  const { business } = await requireShop("retail.manage");
  const t = await getTranslations("shop");
  const format = await getFormatter();
  const sp = await searchParams;

  const filter = FILTERS.find((f) => f === sp.filter) ?? "all";
  const q = typeof sp.q === "string" ? sp.q : "";
  const [customers, stats] = await Promise.all([
    listCustomers(business._id, { filter, q }),
    customerStats(business._id),
  ]);

  const cards = [
    { label: t("customersTotal"), value: stats.total },
    { label: t("customersChronic"), value: stats.chronic },
    { label: t("customersReminders"), value: stats.reminders },
    { label: t("customersLapsed"), value: stats.lapsed },
  ];

  return (
    <>
      <PageHeader title={t("customersTitle")} description={t("customersSubtitle")} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card className="h-fit">
          <CardHeader
            title={t("customerBook")}
            action={
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <Link
                    key={f}
                    href={`/app/shop/customers?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      f === filter ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-muted",
                    )}
                  >
                    {t(`customerFilter.${f}`)}
                  </Link>
                ))}
              </div>
            }
          />
          <form className="border-b border-line px-4 py-3 sm:px-5" action="/app/shop/customers">
            <input type="hidden" name="filter" value={filter} />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder={t("customerPlaceholder")}
              className="h-10 w-full rounded-lg border border-line bg-white px-3 text-base sm:text-sm"
            />
          </form>

          {customers.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">{t("customersEmpty")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {customers.map((c) => (
                <li key={String(c._id)}>
                  <Link
                    href={`/app/shop/customers/${c._id}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-canvas sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted">
                        {[c.phone, c.email].filter(Boolean).join(" · ") || t("noPhone")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(c.conditions ?? []).map((k) => (
                          <Badge key={k} tone="info">
                            {t(`condition.${k}`)}
                          </Badge>
                        ))}
                        {c.consent?.reminders ? <Badge tone="success">{t("remindersOn")}</Badge> : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted">
                      <p>{t("visits", { count: c.visits ?? 0 })}</p>
                      {c.lastVisitAt ? <p>{format.dateTime(new Date(c.lastVisitAt), { dateStyle: "medium" })}</p> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title={t("newCustomerTitle")} description={t("newCustomerHint")} />
          <CustomerForm redirectOnSave />
        </Card>
      </div>
    </>
  );
}
