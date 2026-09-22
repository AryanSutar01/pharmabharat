import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { listConditions } from "@/lib/catalog/queries";
import { requireSeller } from "@/lib/catalog/seller";
import { Listing } from "@/lib/models/listing";
import { Product } from "@/lib/models/product";
import { ListingForm } from "../listing-form";

export const metadata = { title: "Edit listing" };

const isoDate = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default async function EditListingPage({ params }: PageProps<"/app/inventory/[id]">) {
  const { business } = await requireSeller();
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await connectDB();
  const listing = await Listing.findOne({ _id: id, sellerId: business._id }).lean();
  if (!listing) notFound();
  const product = await Product.findById(listing.productId).lean();
  if (!product) notFound();

  const t = await getTranslations("inventory");
  const locale = await getLocale();
  const conditions = await listConditions(locale);

  return (
    <>
      <Link href="/app/inventory" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← {t("title")}
      </Link>
      <PageHeader title={t("editTitle")} />
      <ListingForm
        listingId={String(listing._id)}
        product={{
          id: String(product._id),
          name: product.name,
          manufacturer: product.manufacturer,
          packSizeLabel: product.packSizeLabel ?? "",
          mrp: product.mrp ?? 0,
        }}
        conditions={conditions}
        defaults={{
          batchNo: listing.batchNo,
          mfgDate: isoDate(listing.mfgDate),
          expiryDate: isoDate(listing.expiryDate),
          mrp: String(listing.mrp),
          price: String(listing.price),
          gstRate: String(listing.gstRate),
          hsn: listing.hsn,
          stock: String(listing.stock),
          minOrderQty: String(listing.minOrderQty ?? 1),
          storage: listing.storage ?? "room",
          schedule: listing.schedule,
          conditions: listing.conditions ?? [],
        }}
      />
    </>
  );
}
