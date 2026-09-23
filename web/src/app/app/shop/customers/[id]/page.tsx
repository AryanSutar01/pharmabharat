import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { listBills } from "@/lib/retail/billing";
import { customerPurchases, customerSummary, getCustomer } from "@/lib/retail/customers";
import { requireShop } from "@/lib/retail/guard";
import { CustomerForm, DeleteCustomer } from "../customer-forms";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/app/shop/customers/[id]">) {
  const { business } = await requireShop("retail.manage");
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  const customer = await getCustomer(business._id, id);
  if (!customer) notFound();

  const t = await getTranslations("shop");
  const format = await getFormatter();
  const [summary, purchases, bills] = await Promise.all([
    customerSummary(business._id, id),
    customerPurchases(business._id, id),
    listBills(business._id, { customerId: id, limit: 20 }),
  ]);

  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const day = (d: string | Date) => format.dateTime(new Date(d), { dateStyle: "medium" });
  const anonymised = customer.status === "anonymised";

  const stats = [
    { label: t("visits", { count: summary.bills }), value: inr(summary.spend), hint: t("totalSpend") },
    { label: t("averageBill"), value: inr(summary.average), hint: t("perVisit") },
    {
      label: t("lastVisit"),
      value: summary.lastVisitAt ? day(summary.lastVisitAt) : "—",
      hint: customer.firstVisitAt ? t("since", { date: day(customer.firstVisitAt) }) : "",
    },
  ];

  return (
    <>
      <Link href="/app/shop/customers" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← {t("customersTitle")}
      </Link>
      <PageHeader
        title={customer.name}
        description={[customer.phone, customer.email].filter(Boolean).join(" · ")}
        action={
          <div className="flex flex-wrap gap-1">
            {(customer.conditions ?? []).map((c) => (
              <Badge key={c} tone="info">
                {t(`condition.${c}`)}
              </Badge>
            ))}
            {customer.consent?.reminders ? <Badge tone="success">{t("remindersOn")}</Badge> : null}
            {anonymised ? <Badge tone="danger">{t("anonymised")}</Badge> : null}
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted">{s.hint || s.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("buysRegularly")} description={t("buysRegularlyHint")} />
            {purchases.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">{t("noPurchases")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {purchases.map((p) => (
                  <li key={p.productId} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted">
                        {t("boughtTimes", { count: p.times })} · {t("lastBought", { date: day(p.lastBoughtAt) })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      {p.medianGapDays ? (
                        <Badge tone="neutral">{t("everyDays", { days: p.medianGapDays })}</Badge>
                      ) : (
                        <span className="text-muted">{t("onceOnly")}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t("billsTitle")} />
            {bills.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">{t("billsEmpty")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {bills.map((b) => (
                  <li key={String(b._id)}>
                    <Link
                      href={`/app/shop/bills/${b._id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-canvas sm:px-5"
                    >
                      <span className="text-sm">
                        {b.billNo}
                        <span className="block text-xs text-muted">
                          {format.dateTime(new Date(b.createdAt), { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                          {t("lineCount", { count: b.lines.length })}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">{inr(b.totals?.grandTotal ?? 0)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {anonymised ? (
            <Card className="p-4 text-sm text-muted">{t("anonymisedNote")}</Card>
          ) : (
            <Card className="h-fit">
              <CardHeader
                title={t("customerDetails")}
                description={
                  customer.consent?.at ? t("consentGiven", { date: day(customer.consent.at) }) : t("consentMissing")
                }
              />
              <CustomerForm
                values={{
                  id: String(customer._id),
                  name: customer.name,
                  phone: customer.phone ?? "",
                  email: customer.email ?? "",
                  birthYear: customer.birthYear ? String(customer.birthYear) : "",
                  address: customer.address ?? "",
                  notes: customer.notes ?? "",
                  conditions: customer.conditions ?? [],
                  consent: Boolean(customer.consent?.given),
                  reminders: Boolean(customer.consent?.reminders),
                }}
              />
              <div className="border-t border-line p-4 sm:p-5">
                <DeleteCustomer id={String(customer._id)} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
