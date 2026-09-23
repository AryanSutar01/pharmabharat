import Link from "next/link";
import { isValidObjectId, Types } from "mongoose";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, cn } from "@/components/ui";
import { requireShop } from "@/lib/retail/guard";
import { bestLiveOffer, priceComparison, supplierSummary, topPurchased } from "@/lib/retail/suppliers";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }: PageProps<"/app/shop/suppliers">) {
  const { business } = await requireShop("retail.manage");
  const t = await getTranslations("shop");
  const format = await getFormatter();
  const sp = await searchParams;

  const [suppliers, products] = await Promise.all([supplierSummary(business._id), topPurchased(business._id)]);
  const chosen =
    typeof sp.product === "string" && isValidObjectId(sp.product)
      ? new Types.ObjectId(sp.product)
      : products[0]?._id ?? null;
  const [prices, best] = chosen
    ? await Promise.all([priceComparison(business._id, chosen), bestLiveOffer(business._id, chosen)])
    : [[], null];
  const chosenName = products.find((p) => String(p._id) === String(chosen))?.name ?? "";

  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const inr2 = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const day = (d: string) => format.dateTime(new Date(d), { dateStyle: "medium" });
  const cheapestPaid = prices.length ? Math.min(...prices.map((p) => p.lastPrice)) : 0;

  return (
    <>
      <PageHeader title={t("suppliersTitle")} description={t("suppliersSubtitle")} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card className="h-fit">
          <CardHeader title={t("yourSuppliers")} description={t("yourSuppliersHint")} />
          {suppliers.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">{t("noSuppliers")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {suppliers.map((s) => (
                <li key={s.sellerId} className="space-y-2 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted">
                        {[s.city, t("ordersCount", { count: s.orders }), t("lastOrder", { date: day(s.lastOrderAt) })]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums">{inr(s.spend)}</p>
                      <p className="text-xs text-muted">{t("purchased")}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span>
                      {t("creditTermsShort", { days: s.creditDays })}
                      {s.creditLimit > 0 ? ` · ${t("limit", { amount: inr(s.creditLimit) })}` : ""}
                    </span>
                    {s.outstanding > 0 ? (
                      <Link href={`/app/ledger/${s.sellerId}?side=buyer`} className="text-brand-700 hover:underline">
                        {t("youOwe", { amount: inr(s.outstanding) })}
                      </Link>
                    ) : null}
                    {s.overdue > 0 ? <Badge tone="danger">{t("overdueAmount", { amount: inr(s.overdue) })}</Badge> : null}
                  </div>

                  {s.recalled || s.shortDated ? (
                    <div className="flex flex-wrap gap-1">
                      {s.recalled ? <Badge tone="danger">{t("recalledBatches", { count: s.recalled })}</Badge> : null}
                      {s.shortDated ? <Badge tone="warning">{t("shortDated", { count: s.shortDated })}</Badge> : null}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">{t("noQualityIssues")}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title={t("priceCompare")} description={t("priceCompareHint")} />
          <form className="border-b border-line px-4 py-3 sm:px-5" action="/app/shop/suppliers">
            <select
              name="product"
              defaultValue={String(chosen ?? "")}
              className="h-10 w-full rounded-lg border border-line bg-white px-3 text-base sm:text-sm"
            >
              {products.map((p) => (
                <option key={String(p._id)} value={String(p._id)}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="submit" className="mt-2 text-sm text-brand-700 hover:underline">
              {t("show")}
            </button>
          </form>

          {prices.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">{t("noPurchaseHistory")}</p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {prices.map((p) => (
                  <li key={p.sellerId} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                    <span className="min-w-0 text-sm">
                      {p.name}
                      <span className="block text-xs text-muted">
                        {t("lastBought", { date: day(p.lastBoughtAt) })} · {t("packsShort")} {p.packs}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cn("block font-medium tabular-nums", p.lastPrice === cheapestPaid && "text-emerald-700")}>
                        {inr2(p.lastPrice)}
                      </span>
                      {p.lowestPrice < p.lastPrice ? (
                        <span className="block text-xs text-muted">{t("wasLower", { amount: inr2(p.lowestPrice) })}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              {best ? (
                <div className="border-t border-line px-4 py-3 text-sm sm:px-5">
                  <p className="text-xs text-muted">{t("bestToday")}</p>
                  <p className="mt-0.5">
                    <b className="tabular-nums">{inr2(best.price)}</b> · {best.sellerName}
                    {best.price < cheapestPaid ? (
                      <Badge tone="success">{t("cheaperThanUsual", { amount: inr2(cheapestPaid - best.price) })}</Badge>
                    ) : null}
                  </p>
                  <Link href={`/app/catalog/${String(chosen)}`} className="mt-1 inline-block text-xs text-brand-700 hover:underline">
                    {chosenName} →
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
