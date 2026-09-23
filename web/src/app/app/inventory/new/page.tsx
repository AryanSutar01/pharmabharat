import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { listConditions } from "@/lib/catalog/queries";
import { requireSeller } from "@/lib/catalog/seller";
import { Product } from "@/lib/models/product";
import { ListingForm, type PickedProduct } from "../listing-form";

export const metadata = { title: "Add listing" };

export default async function NewListingPage({ searchParams }: PageProps<"/app/inventory/new">) {
  await requireSeller();
  const t = await getTranslations("inventory");
  const locale = await getLocale();
  const productId = (await searchParams).productId;

  let product: PickedProduct | null = null;
  if (typeof productId === "string" && isValidObjectId(productId)) {
    await connectDB();
    const p = await Product.findById(productId).lean();
    if (p)
      product = {
        id: String(p._id),
        name: p.name,
        manufacturer: p.manufacturer,
        packSizeLabel: p.packSizeLabel ?? "",
        mrp: p.mrp ?? 0,
        hsn: p.hsn ?? "3004",
        gstRate: p.gstRate ?? 5,
      };
  }
  const conditions = await listConditions(locale);

  return (
    <>
      <Link href="/app/inventory" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← {t("title")}
      </Link>
      <PageHeader title={t("newTitle")} />
      <ListingForm
        listingId={null}
        files={[]}
        product={product}
        conditions={conditions}
        defaults={{
          batchNo: "",
          mfgDate: "",
          expiryDate: "",
          mrp: product?.mrp ? String(product.mrp) : "",
          price: "",
          gstRate: String(product?.gstRate ?? 5),
          hsn: product?.hsn ?? "3004",
          stock: "",
          minOrderQty: "1",
          storage: "room",
          schedule: "",
          conditions: [],
        }}
      />
    </>
  );
}
