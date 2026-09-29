import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/ui";
import { shopSettings } from "@/lib/models/shop-settings";
import { dayTotals } from "@/lib/retail/billing";
import { requireShop } from "@/lib/retail/guard";
import { collectsGst } from "@/lib/tax-status";
import { BillingCounter } from "./billing-counter";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const { business } = await requireShop("retail.sell");
  const t = await getTranslations("shop");
  const format = await getFormatter();

  // "Today" for a shop means the local day, and the shop is in India.
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const from = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600 * 1000);
  const to = new Date(from.getTime() + 24 * 3600 * 1000 - 1);
  const [today, settings] = await Promise.all([dayTotals(business._id, from, to), shopSettings(business._id)]);
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  return (
    <>
      <PageHeader
        title={t("billingTitle")}
        description={t("billingSubtitle")}
        action={
          <Link href="/app/shop/bills" className="text-sm text-brand-700 hover:underline">
            {t("allBills")} →
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted">{t("todaySales")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{inr(today.sales)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("todayBills")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{today.bills}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("todayMargin")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{inr(today.margin)}</p>
        </Card>
      </div>

      <BillingCounter loyalty={settings.loyalty} collectsGst={collectsGst(business.taxStatus)} />
    </>
  );
}
