import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { stateName } from "@/lib/india";
import { getCartView, requireBuyer, type CartLine } from "@/lib/orders/cart";
import { round2 } from "@/lib/orders/gst";
import { CartQty, CheckoutForm } from "./cart-controls";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const { business, session } = await requireBuyer();
  const t = await getTranslations();
  const format = await getFormatter();
  const { groups, hasIssues } = await getCartView(business, session.user.id);
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const monthYear = (d: string) => format.dateTime(new Date(d), { month: "short", year: "numeric" });

  if (!groups.length) {
    return (
      <>
        <PageHeader title={t("cart.title")} />
        <Card className="px-4 py-12 text-center">
          <p className="text-sm text-muted">{t("cart.empty")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/app/catalog" className={buttonClass("primary")}>
              {t("cart.browse")}
            </Link>
            <Link href="/app/cart/quick" className={buttonClass("secondary")}>
              {t("cart.quickOrder")}
            </Link>
          </div>
        </Card>
      </>
    );
  }

  // Each order is rounded separately, so the cart total is the sum of order totals.
  const sum = (f: (tt: (typeof groups)[number]["totals"]) => number) => round2(groups.reduce((a, g) => a + f(g.totals), 0));
  const taxable = sum((x) => x.taxable);
  const tax = sum((x) => x.tax);
  const grand = sum((x) => x.grandTotal);

  const issueText = (l: CartLine) =>
    l.issue === "unavailable"
      ? t("cart.unavailable")
      : l.issue === "below_moq"
        ? t("cart.belowMoq", { count: l.minOrderQty })
        : l.issue === "insufficient_stock"
          ? t("cart.insufficientStock", { count: l.stock })
          : null;

  return (
    <>
      <PageHeader
        title={t("cart.title")}
        description={t("cart.subtitle")}
        action={
          <Link href="/app/cart/quick" className="text-sm text-brand-700 hover:underline">
            {t("cart.quickOrder")} →
          </Link>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          {groups.map((g) => (
            <Card key={g.sellerId}>
              <CardHeader
                title={g.sellerName}
                description={`${g.sellerCity}, ${stateName(g.sellerStateCode)}`}
                action={<Badge tone={g.interState ? "warning" : "info"}>{g.interState ? t("cart.interState") : t("cart.sameState")}</Badge>}
              />
              <ul className="divide-y divide-line">
                {g.lines.map((l) => (
                  <li key={l.listingId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/app/catalog/${l.productId}`} className="font-medium hover:underline">
                        {l.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {l.packSizeLabel} · {t("orders.batch")} {l.batchNo} · {t("orders.exp")} {monthYear(l.expiryDate)}
                      </p>
                      <p className="text-xs text-muted">
                        {inr(l.price)} × {l.qty} · {t("catalog.gst")} {l.gstRate}% · {t("catalog.mrp")} {inr(l.mrp)}
                      </p>
                      {l.issue ? <p className="mt-1 text-xs font-medium text-red-600">{issueText(l)}</p> : null}
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <CartQty listingId={l.listingId} qty={l.qty} />
                      <span className="w-24 text-right font-semibold tabular-nums">{inr(l.lineTotal)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <dl className="space-y-1 border-t border-line px-4 py-3 text-sm sm:px-5">
                <TotalRow label={t("cart.taxable")} value={inr(g.totals.taxable)} />
                {g.interState ? (
                  <TotalRow label={t("cart.igst")} value={inr(g.totals.igst)} />
                ) : (
                  <>
                    <TotalRow label={t("cart.cgst")} value={inr(g.totals.cgst)} />
                    <TotalRow label={t("cart.sgst")} value={inr(g.totals.sgst)} />
                  </>
                )}
                <TotalRow label={t("cart.roundOff")} value={inr(g.totals.roundOff)} />
                <TotalRow label={t("cart.orderTotal")} value={inr(g.totals.grandTotal)} strong />
              </dl>
            </Card>
          ))}
        </div>

        <Card className="h-fit xl:sticky xl:top-8">
          <CardHeader title={t("cart.summary")} description={t("cart.orders", { count: groups.length })} />
          <div className="space-y-4 p-4 sm:p-5">
            <dl className="space-y-1 text-sm">
              <TotalRow label={t("cart.taxable")} value={inr(taxable)} />
              <TotalRow label={t("catalog.gst")} value={inr(tax)} />
              <TotalRow label={t("cart.grandTotal")} value={inr(grand)} strong />
            </dl>
            <CheckoutForm orderCount={groups.length} blocked={hasIssues} />
          </div>
        </Card>
      </div>
    </>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t border-line pt-2 text-base font-semibold" : "flex justify-between text-muted"}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
