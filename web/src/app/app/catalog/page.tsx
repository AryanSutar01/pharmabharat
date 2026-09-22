import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Badge, Button, Card, Input, PageHeader, buttonClass, cn } from "@/components/ui";
import { formatComposition } from "@/lib/catalog/normalize";
import { listConditions, searchProducts } from "@/lib/catalog/queries";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "Catalog" };

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function CatalogPage({ searchParams }: PageProps<"/app/catalog">) {
  await requireBusiness();
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const condition = one(sp.condition);
  const page = Number(one(sp.page)) || 1;

  const locale = await getLocale();
  const [t, format, conditions] = await Promise.all([getTranslations(), getFormatter(), listConditions(locale)]);
  const active = q || condition;
  const { hits, hasMore } = active ? await searchProducts({ q, condition, page }) : { hits: [], hasMore: false };
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });

  const href = (params: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) u.set(k, String(v));
    const s = u.toString();
    return s ? `/app/catalog?${s}` : "/app/catalog";
  };

  return (
    <>
      <PageHeader title={t("catalog.title")} description={t("catalog.subtitle")} />

      <form action="/app/catalog" className="flex gap-2">
        {condition ? <input type="hidden" name="condition" value={condition} /> : null}
        <Input
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("catalog.searchPlaceholder")}
          aria-label={t("catalog.search")}
          autoComplete="off"
          enterKeyHint="search"
          className="flex-1"
        />
        <Button type="submit">{t("catalog.search")}</Button>
      </form>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t("catalog.byCondition")}</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link
            href={href({ q })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              !condition ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-muted hover:text-ink",
            )}
          >
            {t("catalog.allConditions")}
          </Link>
          {conditions.map((c) => (
            <Link
              key={c.slug}
              href={href({ q, condition: c.slug })}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                condition === c.slug
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-line bg-white text-muted hover:text-ink",
              )}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {!active ? (
          <Card className="px-4 py-12 text-center text-sm text-muted">{t("catalog.startHint")}</Card>
        ) : hits.length === 0 ? (
          <Card className="px-4 py-12 text-center text-sm text-muted">{t("catalog.noResults")}</Card>
        ) : (
          <>
            <Card>
              <ul className="divide-y divide-line">
                {hits.map((p) => (
                  <li key={p.id}>
                    <Link href={`/app/catalog/${p.id}`} className="flex gap-3 px-4 py-3 hover:bg-canvas sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{p.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted">{formatComposition(p.ingredients)}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {p.manufacturer} · {p.packSizeLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                        {p.offers ? (
                          <>
                            <span className="font-semibold">{inr(p.offers.bestPrice)}</span>
                            <Badge tone="success">{t("catalog.marginValue", { value: p.offers.bestMargin })}</Badge>
                            <span className="text-xs text-muted">{t("catalog.sellers", { count: p.offers.sellers })}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm text-muted">
                              {t("catalog.mrp")} {p.mrp ? inr(p.mrp) : "—"}
                            </span>
                            <span className="text-xs text-muted">{t("catalog.noSellers")}</span>
                          </>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            {page > 1 || hasMore ? (
              <div className="mt-4 flex justify-center gap-3">
                {page > 1 ? (
                  <Link href={href({ q, condition, page: page - 1 })} className={buttonClass("secondary")}>
                    ← {t("catalog.prevPage")}
                  </Link>
                ) : null}
                {hasMore ? (
                  <Link href={href({ q, condition, page: page + 1 })} className={buttonClass("secondary")}>
                    {t("catalog.loadMore")} →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
