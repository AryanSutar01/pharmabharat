import Link from "next/link";
import { notFound } from "next/navigation";
import { Types, isValidObjectId } from "mongoose";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, cn } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { accountSummary, statement } from "@/lib/ledger/service";
import { Business } from "@/lib/models/business";
import { Order } from "@/lib/models/order";
import { requireBusiness } from "@/lib/session";
import { CreditTermsForm, RecordPaymentForm } from "./ledger-forms";

export const metadata = { title: "Statement" };

export default async function LedgerAccountPage({ params, searchParams }: PageProps<"/app/ledger/[id]">) {
  const { business } = await requireBusiness({ permission: "billing.view" });
  const { id } = await params;
  const sp = await searchParams;
  if (!isValidObjectId(id)) notFound();

  // "seller" = they owe me; "buyer" = I owe them.
  const side = sp.side === "buyer" ? "buyer" : "seller";
  const partyId = new Types.ObjectId(id);
  const sellerId = side === "seller" ? business._id : partyId;
  const buyerId = side === "seller" ? partyId : business._id;

  await connectDB();
  const [party, traded] = await Promise.all([
    Business.findById(partyId, { legalName: 1, tradeName: 1, address: 1, phone: 1, email: 1 }).lean(),
    Order.exists({ sellerId, buyerId }),
  ]);
  if (!party || !traded) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const now = new Date();
  const [summary, rows] = await Promise.all([accountSummary(sellerId, buyerId, now), statement(sellerId, buyerId)]);

  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const day = (d: string | Date) => format.dateTime(new Date(d), { dateStyle: "medium" });
  const today = now.toISOString().slice(0, 10);

  const stats = [
    { label: t(`ledger.outstanding.${side}`), value: inr(summary.outstanding) },
    { label: t("ledger.overdue"), value: inr(summary.overdue), danger: summary.overdue > 0 },
    {
      label: t("ledger.creditLimit"),
      value: summary.creditLimit > 0 ? inr(summary.creditLimit) : t("ledger.noLimit"),
    },
    {
      label: t("ledger.available"),
      value: summary.available === null ? "—" : inr(summary.available),
      danger: summary.available !== null && summary.available <= 0,
    },
  ];

  return (
    <>
      <PageHeader
        title={party.tradeName || party.legalName}
        description={[party.address?.city, t("ledger.termsSummary", { days: summary.creditDays })].filter(Boolean).join(" · ")}
        action={
          <Link href={`/app/ledger?side=${side}`} className="text-sm text-brand-700 hover:underline">
            {t("ledger.backToAccounts")}
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className={cn("mt-1 text-lg font-semibold tabular-nums", s.danger && "text-red-600")}>{s.value}</p>
          </Card>
        ))}
      </div>

      {summary.overdue > 0 ? (
        <div className="mb-5">
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {t("ledger.overdueNotice", { days: summary.daysOverdue, amount: inr(summary.overdue) })}
          </Card>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="overflow-hidden">
          <CardHeader title={t("ledger.statement")} description={t("ledger.statementHint")} />
          {rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">{t("ledger.noEntries")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={`${r.kind}-${r.id}`} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {r.href ? (
                        <Link href={r.href} className="hover:underline">
                          {r.label}
                        </Link>
                      ) : (
                        t(`ledger.methodLabel.${r.status ?? "cash"}`)
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {day(r.date)}
                      {r.kind === "invoice" && r.dueAt ? ` · ${t("ledger.due", { date: day(r.dueAt) })}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("font-medium tabular-nums", r.kind === "payment" && "text-emerald-700")}>
                      {r.kind === "payment" ? `− ${inr(r.credit)}` : inr(r.debit)}
                    </p>
                    <p className="text-xs text-muted tabular-nums">{t("ledger.balance", { amount: inr(r.balance) })}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {side === "seller" ? (
          <div className="space-y-5">
            <Card>
              <CardHeader title={t("ledger.recordPayment")} description={t("ledger.recordPaymentHint")} />
              <RecordPaymentForm buyerId={String(partyId)} outstanding={summary.outstanding} today={today} />
            </Card>
            <Card>
              <CardHeader title={t("ledger.creditTerms")} />
              <CreditTermsForm
                buyerId={String(partyId)}
                creditLimit={summary.creditLimit}
                creditDays={summary.creditDays}
                note={summary.note}
              />
            </Card>
          </div>
        ) : (
          <Card className="h-fit p-4 text-sm text-muted">
            <p>{t("ledger.buyerSideHint")}</p>
            {summary.openCount > 0 ? (
              <p className="mt-2">
                <Badge tone="warning">{t("ledger.invoiceCount", { count: summary.openCount })}</Badge>
              </p>
            ) : null}
          </Card>
        )}
      </div>
    </>
  );
}
