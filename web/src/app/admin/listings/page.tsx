import Link from "next/link";
import { Types } from "mongoose";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { suggestProducts } from "@/lib/catalog/queries";
import { connectDB } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { Listing } from "@/lib/models/listing";
import { Product } from "@/lib/models/product";
import { requirePlatformRole } from "@/lib/session";
import { DocPreviewGrid } from "@/components/doc-preview-grid";
import { cloudinaryConfigured, fileUrl, previewUrl } from "@/lib/cloudinary";
import { ListingModeration } from "./listing-moderation";

export const metadata = { title: "Listings" };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function AdminListingsPage({ searchParams }: PageProps<"/admin/listings">) {
  await requirePlatformRole("admin");
  const t = await getTranslations();
  const format = await getFormatter();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 80) : "";

  await connectDB();
  let filter: Record<string, unknown> = {};
  if (q) {
    // Sellers by name (small collection); products via Atlas Search (the catalog is large).
    const [sellers, products] = await Promise.all([
      Business.find({ $or: [{ legalName: { $regex: escapeRegex(q), $options: "i" } }, { tradeName: { $regex: escapeRegex(q), $options: "i" } }] }, { _id: 1 })
        .limit(50)
        .lean(),
      suggestProducts(q, 20),
    ]);
    filter = {
      $or: [
        { sellerId: { $in: sellers.map((s) => s._id) } },
        { productId: { $in: products.map((p) => new Types.ObjectId(p.id)) } },
      ],
    };
  }
  const listings = await Listing.find(filter).sort({ "moderation.held": -1, updatedAt: -1 }).limit(100).lean();
  const [products, sellers] = await Promise.all([
    Product.find({ _id: { $in: listings.map((l) => l.productId) } }, { name: 1 }).lean(),
    Business.find({ _id: { $in: listings.map((l) => l.sellerId) } }, { legalName: 1, tradeName: 1 }).lean(),
  ]);
  const productName = new Map(products.map((p) => [String(p._id), p.name]));
  const sellerName = new Map(sellers.map((s) => [String(s._id), s.tradeName || s.legalName]));
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });

  return (
    <>
      <PageHeader title={t("admin.listingsTab")} />
      <form className="mb-4 flex gap-2">
        <Input name="q" type="search" defaultValue={q} placeholder={t("admin.searchListings")} className="max-w-sm" />
        <Button type="submit" variant="secondary">
          {t("admin.search")}
        </Button>
      </form>
      <Card>
        <ul className="divide-y divide-line">
          {listings.map((l) => (
            <li key={String(l._id)} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <Link href={`/app/catalog/${l.productId}`} className="font-medium hover:underline">
                  {productName.get(String(l.productId)) ?? "—"}
                </Link>
                <p className="text-xs text-muted">
                  {t("admin.seller")}: {sellerName.get(String(l.sellerId)) ?? "—"} · {t("inventory.batch")} {l.batchNo} · {inr(l.price)} /{" "}
                  {t("catalog.mrp")} {inr(l.mrp)} · {t("catalog.stock")} {l.stock}
                </p>
                {(l.files ?? []).length && cloudinaryConfigured() ? (
                  <div className="mt-2 max-w-md">
                    <DocPreviewGrid
                      size="sm"
                      openLabel={t("common.view")}
                      items={(l.files ?? []).map((f, i) => ({
                        id: `${l._id}-${i}`,
                        label: t(`inventory.fileKind.${f.kind}`),
                        thumb: previewUrl(f.publicId, 200),
                        href: fileUrl(f.publicId, f.format ?? "jpg"),
                        tone: f.kind === "invoice" ? ("warning" as const) : undefined,
                      }))}
                    />
                  </div>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={l.status === "active" ? "success" : "neutral"}>{t(`inventory.${l.status}`)}</Badge>
                  {(l.files ?? []).some((f) => f.kind === "box") ? null : <Badge tone="warning">{t("inventory.photosNeeded")}</Badge>}
                  {l.moderation?.held ? <Badge tone="danger">{t("admin.held")}</Badge> : null}
                  {l.moderation?.held && l.moderation.reason ? <span className="text-xs text-red-700">“{l.moderation.reason}”</span> : null}
                </div>
              </div>
              <ListingModeration id={String(l._id)} held={Boolean(l.moderation?.held)} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
