"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Product } from "@/lib/models/product";
import { requireShop } from "@/lib/retail/guard";
import { addStock, removeStock, setStockUnits } from "@/lib/retail/stock";
import { shopStockSchema } from "@/lib/validation/shop-stock";

export type StockFormState = { ok?: boolean; errors?: Record<string, string>; values?: Record<string, string> };

export async function addShopStock(_: StockFormState, formData: FormData): Promise<StockFormState> {
  const { business, session } = await requireShop("retail.manage");
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = shopStockSchema.safeParse(raw);
  // React clears the form after an action, so echo the values back on failure.
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] = issue.message;
    return { errors, values: raw };
  }

  await connectDB();
  const product = await Product.findById(parsed.data.productId, {
    name: 1,
    manufacturer: 1,
    packSizeLabel: 1,
    schedule: 1,
  }).lean();
  if (!product) return { errors: { productId: "product_not_found" }, values: raw };

  await addStock(
    business._id,
    {
      ...parsed.data,
      name: product.name,
      manufacturer: product.manufacturer ?? undefined,
      packSizeLabel: product.packSizeLabel ?? undefined,
      schedule: parsed.data.schedule ?? product.schedule ?? undefined,
      unitsPerPack: parsed.data.unitsPerPack,
      source: "manual",
    },
    session.user.id,
  );
  revalidatePath("/app/shop/stock");
  return { ok: true };
}

/** `units` is in the smallest sellable unit — tablets, not strips. */
export async function updateShopStockUnits(stockId: string, units: number) {
  const { business } = await requireShop("retail.manage");
  if (!isValidObjectId(stockId) || !Number.isInteger(units) || units < 0 || units > 10_000_000) return { error: "invalid" };
  await setStockUnits(business._id, stockId, units);
  revalidatePath("/app/shop/stock");
  return { ok: true };
}

export async function deleteShopStock(stockId: string) {
  const { business } = await requireShop("retail.manage");
  if (!isValidObjectId(stockId)) return { error: "invalid" };
  await removeStock(business._id, stockId);
  revalidatePath("/app/shop/stock");
  return { ok: true };
}
