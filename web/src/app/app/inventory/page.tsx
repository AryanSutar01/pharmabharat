import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { marginPercent } from "@/lib/catalog/normalize";
import { requireSeller } from "@/lib/catalog/seller";
import { Listing } from "@/lib/models/listing";
import { Product } from "@/lib/models/product";
import { CsvImport, ListingActions, StockInput } from "./inventory-controls";

export const metadata = { title: "Inventory" };

const DAY = 24 * 3600 * 1000;

export default async function InventoryPage({ searchParams }: PageProps<"/app/inventory">) {
  const { business } = await requireSeller();
  const t = await getTranslations();
  const format = await getFormatter();

  const expiringOnly = (await searchParams).filter === "expiring";
  // Captured once per request so the query and every row use the same "now".
  const now = new Date().getTime();

  await connectDB();
  const listings = await Listing.find({
    sellerId: business._id,
    ...(expiringOnly ? { expiryDate: { $lte: new Date(now + 90 * DAY) } } : {}),
  })
    .sort(expiringOnly ? { expiryDate: 1 } : { updatedAt: -1 })
    .limit(500)
    .lean();
  const products = await Product.find(
    { _id: { $in: listings.map((l) => l.productId) } },
    { name: 1, manufacturer: 1, packSizeLabel: 1 },
  ).lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const monthYear = (d: Date) => format.dateTime(new Date(d), { month: "short", year: "numeric" });

  function flags(l: (typeof listings)[number]) {
    const days = (new Date(l.expiryDate).getTime() - now) / DAY;
    const out: { tone: "danger" | "warning" | "neutral"; label: string }[] = [];
    if (days <= 0) out.push({ tone: "danger", label: t("inventory.expired") });
    else if (days <= 90) out.push({ tone: "warning", label: t("inventory.expiringSoon") });
    if (l.stock === 0) out.push({ tone: "danger", label: t("inventory.outOfStock") });
    if (l.moderation?.held) {
      out.push({ tone: "danger", label: `${t("admin.held")}${l.moderation.reason ? `: ${l.moderation.reason}` : ""}` });
    } else if (l.status === "paused") out.push({ tone: "neutral", label: t("inventory.paused") });
    return out;
  }

  return (
    <>
      <PageHeader
        title={t("inventory.title")}
        description={t("inventory.subtitle")}
        action={
          <Link href="/app/inventory/new" className={buttonClass("primary")}>
            + {t("inventory.add")}
          </Link>
        }
      />

      <div className="mb-4 flex gap-2 text-sm">
        {[
          { href: "/app/inventory", label: t("inventory.filterAll"), on: !expiringOnly },
          { href: "/app/inventory?filter=expiring", label: t("inventory.filterExpiring"), on: expiringOnly },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={
              f.on
                ? "rounded-full border border-brand-600 bg-brand-50 px-3 py-1 text-brand-800"
                : "rounded-full border border-line bg-white px-3 py-1 text-muted"
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <Card>
          {listings.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">{t("inventory.empty")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {listings.map((l) => {
                const p = productById.get(String(l.productId));
                return (
                  <li key={String(l._id)} className="flex flex-col gap-2 px-4 py-3 sm:px-5 md:flex-row md:items-center md:gap-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/app/catalog/${l.productId}`} className="font-medium hover:underline">
                        {p?.name ?? "—"}
                      </Link>
                      <p className="text-xs text-muted">
                        {t("inventory.batch")} {l.batchNo} · {t("catalog.expiry")} {monthYear(l.expiryDate)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {flags(l).map((f) => (
                          <Badge key={f.label} tone={f.tone}>
                            {f.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{inr(l.price)}</p>
                        <p className="text-xs text-muted">
                          {t("catalog.mrp")} {inr(l.mrp)} · {marginPercent(l.mrp, l.price)}%
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted">
                        {t("catalog.stock")}
                        <StockInput id={String(l._id)} stock={l.stock} />
                      </label>
                      <ListingActions id={String(l._id)} status={l.status as "active" | "paused"} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title={t("inventory.csvTitle")} />
          <div className="p-4 sm:p-5">
            <CsvImport />
          </div>
        </Card>
      </div>
    </>
  );
}
