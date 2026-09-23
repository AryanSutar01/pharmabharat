import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { listBills } from "@/lib/retail/billing";
import { requireShop } from "@/lib/retail/guard";

export const metadata = { title: "Bills" };

export default async function BillsPage() {
  const { business } = await requireShop("retail.sell");
  const t = await getTranslations("shop");
  const format = await getFormatter();
  const bills = await listBills(business._id, { limit: 100 });
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });

  return (
    <>
      <PageHeader
        title={t("billsTitle")}
        description={t("billsSubtitle")}
        action={
          <Link href="/app/shop/billing" className={buttonClass("primary")}>
            + {t("newBill")}
          </Link>
        }
      />
      <Card>
        {bills.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">{t("billsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {bills.map((b) => (
              <li key={String(b._id)}>
                <Link
                  href={`/app/shop/bills/${b._id}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-canvas sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{b.customer?.name || t("walkIn")}</p>
                    <p className="text-xs text-muted">
                      {b.billNo} · {format.dateTime(new Date(b.createdAt), { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                      {t("lineCount", { count: b.lines.length })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{inr(b.totals?.grandTotal ?? 0)}</span>
                    <Badge tone={b.status === "cancelled" ? "danger" : "neutral"}>
                      {b.status === "cancelled" ? t("cancelled") : t(`payMode.${b.payment?.mode ?? "cash"}`)}
                    </Badge>
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
