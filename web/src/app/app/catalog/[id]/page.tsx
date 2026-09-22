import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AddToCart } from "@/components/add-to-cart";
import { PriceAlertForm } from "@/components/price-alert-form";
import { PriceAlert } from "@/lib/models/price-alert";
import { Badge, Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { stateName } from "@/lib/india";
import { formatComposition, marginPercent } from "@/lib/catalog/normalize";
import { getProductWithOffers, getSubstitutes, listConditions } from "@/lib/catalog/queries";
import { isSellerType } from "@/lib/catalog/seller";
import { can } from "@/lib/permissions";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Product" };

export default async function ProductPage({ params }: PageProps<"/app/catalog/[id]">) {
  const { business, role, session } = await requireBusiness();
  const { id } = await params;
  const data = await getProductWithOffers(id);
  if (!data) notFound();
  const { product, offers } = data;

  const locale = await getLocale();
  const [t, format, substitutes, conditions] = await Promise.all([
    getTranslations(),
    getFormatter(),
    getSubstitutes(product),
    listConditions(locale),
  ]);
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const monthYear = (d: Date) => format.dateTime(new Date(d), { month: "short", year: "numeric" });
  const conditionName = new Map(conditions.map((c) => [c.slug, c.label]));
  const canSell = isSellerType(business.type) && can(role, "inventory.manage");
  const canBuy = business.type !== "company" && can(role, "orders.place");
  const alert = await PriceAlert.findOne({ userId: session.user.id, businessId: business._id, productId: product._id }).lean();
  const buyable = (sellerId: string) => canBuy && sellerId !== String(business._id);

  return (
    <>
      <Link href="/app/catalog" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← {t("catalog.title")}
      </Link>
      <PageHeader
        title={product.name}
        description={`${product.manufacturer} · ${product.packSizeLabel ?? ""}`}
        action={
          canSell ? (
            <Link href={`/app/inventory/new?productId=${product._id}`} className={buttonClass("primary")}>
              {t("catalog.sellThis")}
            </Link>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("catalog.offersTitle")} description={t("catalog.priceExclGst")} />
            {offers.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted sm:px-5">{t("catalog.offersEmpty")}</p>
            ) : (
              <>
                {/* Phone: stacked cards */}
                <ul className="divide-y divide-line md:hidden">
                  {offers.map((o) => (
                    <li key={o.id} className="space-y-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{o.sellerName}</p>
                          <p className="text-xs text-muted">
                            {o.sellerCity}, {stateName(o.sellerStateCode)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{inr(o.price)}</p>
                          <Badge tone="success">{t("catalog.marginValue", { value: o.margin })}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted">
                        {t("catalog.expiry")} {monthYear(o.expiryDate)} · {t("catalog.stock")} {o.stock} · {t("catalog.moq")}{" "}
                        {o.minOrderQty} · {t("catalog.gst")} {o.gstRate}%
                      </p>
                      {buyable(o.sellerId) ? (
                        <AddToCart listingId={o.id} minOrderQty={o.minOrderQty} stock={o.stock} />
                      ) : null}
                    </li>
                  ))}
                </ul>
                {/* Tablet / desktop: table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted">
                      <tr className="border-b border-line">
                        <th className="px-5 py-2 font-medium">{t("catalog.seller")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("catalog.price")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("catalog.margin")}</th>
                        <th className="px-3 py-2 font-medium">{t("catalog.expiry")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("catalog.stock")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("catalog.gst")}</th>
                        {canBuy ? <th className="px-5 py-2" /> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {offers.map((o) => (
                        <tr key={o.id}>
                          <td className="px-5 py-3">
                            <p className="font-medium">{o.sellerName}</p>
                            <p className="text-xs text-muted">
                              {o.sellerCity}, {stateName(o.sellerStateCode)} · {t("catalog.moq")} {o.minOrderQty}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">{inr(o.price)}</td>
                          <td className="px-3 py-3 text-right">
                            <Badge tone="success">{o.margin}%</Badge>
                          </td>
                          <td className="px-3 py-3 tabular-nums">{monthYear(o.expiryDate)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{o.stock}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{o.gstRate}%</td>
                          {canBuy ? (
                            <td className="px-5 py-3">
                              {buyable(o.sellerId) ? (
                                <AddToCart listingId={o.id} minOrderQty={o.minOrderQty} stock={o.stock} compact />
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title={t("catalog.substitutesTitle")} />
            {substitutes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted sm:px-5">{t("catalog.substitutesEmpty")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {substitutes.map((s) => (
                  <li key={s.id}>
                    <Link href={`/app/catalog/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.name}</p>
                        <p className="truncate text-xs text-muted">
                          {s.manufacturer} · {s.packSizeLabel}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-sm">
                        {s.offers ? (
                          <>
                            <p className="font-semibold">{inr(s.offers.bestPrice)}</p>
                            <p className="text-xs text-brand-700">
                              {t("catalog.marginValue", { value: s.offers.bestMargin })}
                            </p>
                          </>
                        ) : (
                          <p className="text-muted">
                            {t("catalog.mrp")} {s.mrp ? inr(s.mrp) : "—"}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title={t("catalog.composition")} />
          <div className="px-4 pt-4 sm:px-5">
            <PriceAlertForm
              productId={String(product._id)}
              existing={
                alert
                  ? { id: String(alert._id), direction: alert.direction ?? "drop", thresholdPct: alert.thresholdPct ?? 0, email: alert.email ?? true }
                  : null
              }
            />
          </div>
          <dl className="space-y-3 p-4 text-sm sm:p-5">
            <div>
              <dt className="text-muted">{t("catalog.composition")}</dt>
              <dd className="mt-0.5 font-medium">{formatComposition(product.ingredients) || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("catalog.form")}</dt>
              <dd className="mt-0.5 font-medium">{t(`dosageForm.${product.form ?? "other"}`)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("catalog.pack")}</dt>
              <dd className="mt-0.5 font-medium">{product.packSizeLabel || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("catalog.mrp")}</dt>
              <dd className="mt-0.5 font-medium">{product.mrp ? inr(product.mrp) : "—"}</dd>
            </div>
            {offers[0] && product.mrp ? (
              <div>
                <dt className="text-muted">{t("catalog.bestPrice")}</dt>
                <dd className="mt-0.5 font-medium">
                  {inr(offers[0].price)} ({marginPercent(offers[0].mrp, offers[0].price)}%)
                </dd>
              </div>
            ) : null}
            {product.conditions?.length ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {product.conditions.map((c) => (
                  <Link key={c} href={`/app/catalog?condition=${c}`}>
                    <Badge tone="info">{conditionName.get(c) ?? c}</Badge>
                  </Link>
                ))}
              </div>
            ) : null}
          </dl>
        </Card>
      </div>
    </>
  );
}
