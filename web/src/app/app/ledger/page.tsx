import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, EmptyState, PageHeader, cn } from "@/components/ui";
import { isSellerType } from "@/lib/catalog/seller";
import { accountRows } from "@/lib/ledger/service";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Ledger" };

export default async function LedgerPage({ searchParams }: PageProps<"/app/ledger">) {
  const { business } = await requireBusiness({ permission: "billing.view" });
  const t = await getTranslations();
  const format = await getFormatter();
  const sp = await searchParams;

  const sides = [
    ...(isSellerType(business.type) ? (["seller"] as const) : []),
    ...(business.type !== "company" ? (["buyer"] as const) : []),
  ];
  const side = sides.find((s) => s === sp.side) ?? sides[0] ?? "seller";
  const now = new Date();
  const rows = await accountRows(business._id, side, now);

  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const total = rows.reduce((a, r) => a + r.outstanding, 0);
  const overdue = rows.reduce((a, r) => a + r.overdue, 0);

  return (
    <>
      <PageHeader title={t("ledger.title")} description={t(`ledger.description.${side}`)} />

      {sides.length > 1 ? (
        <div className="mb-4 inline-flex rounded-lg border border-line bg-white p-1">
          {sides.map((s) => (
            <Link
              key={s}
              href={`/app/ledger?side=${s}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                s === side ? "bg-brand-50 text-brand-800" : "text-muted hover:text-ink",
              )}
            >
              {t(`ledger.side.${s}`)}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs text-muted">{t(`ledger.outstanding.${side}`)}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{inr(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("ledger.overdue")}</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", overdue > 0 && "text-red-600")}>{inr(overdue)}</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title={t("ledger.empty")} />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.businessId}>
                <Link
                  href={`/app/ledger/${r.businessId}?side=${side}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-canvas sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted">
                      {[r.city, t("ledger.invoiceCount", { count: r.invoices })].filter(Boolean).join(" · ")}
                      {r.lastPaymentAt
                        ? ` · ${t("ledger.lastPayment", { date: format.dateTime(new Date(r.lastPaymentAt), { dateStyle: "medium" }) })}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{inr(r.outstanding)}</span>
                    {r.overdue > 0 ? (
                      <Badge tone="danger">{t("ledger.overdueBy", { days: r.daysOverdue, amount: inr(r.overdue) })}</Badge>
                    ) : (
                      <span className="text-xs text-muted">{t("ledger.withinTerms")}</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
