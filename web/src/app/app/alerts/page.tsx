import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, PageHeader } from "@/components/ui";
import { bestPrices } from "@/lib/alerts/price";
import { pctChange } from "@/lib/alerts/rules";
import { connectDB } from "@/lib/db/mongo";
import { PriceAlert } from "@/lib/models/price-alert";
import { Product } from "@/lib/models/product";
import { requireBusiness } from "@/lib/session";
import { RemoveAlertButton } from "./remove-alert-button";

export const metadata = { title: "Price alerts" };

export default async function AlertsPage() {
  const { business, session } = await requireBusiness();
  const t = await getTranslations();
  const format = await getFormatter();

  await connectDB();
  const alerts = await PriceAlert.find({ userId: session.user.id, businessId: business._id }).sort({ createdAt: -1 }).lean();
  const productIds = alerts.map((a) => a.productId);
  const [products, prices] = await Promise.all([
    Product.find({ _id: { $in: productIds } }, { name: 1, manufacturer: 1 }).lean(),
    bestPrices(productIds),
  ]);
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });

  return (
    <>
      <PageHeader title={t("alerts.title")} description={t("alerts.subtitle")} />
      <Card>
        {alerts.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">{t("alerts.empty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {alerts.map((a) => {
              const p = productById.get(String(a.productId));
              const current = prices.get(String(a.productId));
              const change = a.referencePrice && current ? pctChange(a.referencePrice, current) : 0;
              return (
                <li key={String(a._id)} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <Link href={`/app/catalog/${a.productId}`} className="font-medium hover:underline">
                      {p?.name ?? "—"}
                    </Link>
                    <p className="text-xs text-muted">{p?.manufacturer}</p>
                    <div className="mt-1">
                      <Badge tone="info">
                        {t("alerts.summary", { direction: a.direction ?? "drop", threshold: String(a.thresholdPct ?? 0) })}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {current !== undefined && a.referencePrice != null ? (
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">
                          {inr(current)}{" "}
                          {change ? (
                            <span className={change < 0 ? "text-brand-700" : "text-red-600"}>
                              ({change > 0 ? "+" : ""}
                              {change}%)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted">
                          {t("alerts.reference")} {inr(a.referencePrice)}
                        </p>
                      </div>
                    ) : (
                      <p className="max-w-56 text-xs text-muted">{t("alerts.noSellers")}</p>
                    )}
                    <RemoveAlertButton id={String(a._id)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
