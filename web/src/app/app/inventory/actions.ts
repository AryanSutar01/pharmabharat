"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Types, isValidObjectId } from "mongoose";
import { parse } from "csv-parse/sync";
import { checkPriceAlertsSafely } from "@/lib/alerts/price";
import { connectDB } from "@/lib/db/mongo";
import { compositionKeys, saltKeyOf } from "@/lib/catalog/normalize";
import { requireSeller } from "@/lib/catalog/seller";
import { Condition } from "@/lib/models/condition";
import { Listing } from "@/lib/models/listing";
import { NAME_COLLATION, Product } from "@/lib/models/product";
import { fieldErrors } from "@/lib/validation/business";
import { listingSchema, parseFlexibleDate, sellerProductSchema } from "@/lib/validation/listing";

export type ListingFormState = {
  ok?: boolean;
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
};

function formValues(formData: FormData) {
  const v: Record<string, string> = {};
  for (const [k, val] of formData.entries()) if (typeof val === "string") v[k] = val;
  return v;
}

export async function saveListing(listingId: string | null, _: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const { business } = await requireSeller();
  const values = formValues(formData);
  const parsed = listingSchema.safeParse({ ...values, conditions: formData.getAll("conditions") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const data = parsed.data;

  await connectDB();
  if (!(await Product.exists({ _id: data.productId, active: true }))) return { errors: { productId: "not_found" }, values };
  if (data.conditions.length) {
    const valid = await Condition.find({ slug: { $in: data.conditions } }, { slug: 1 }).lean();
    data.conditions = valid.map((c) => c.slug);
  }

  const doc = { ...data, sellerId: business._id, sellerStateCode: business.address!.stateCode };
  try {
    if (listingId) {
      if (!isValidObjectId(listingId)) return { message: "not_found", values };
      const existing = await Listing.findOne({ _id: listingId, sellerId: business._id }, { expiryDate: 1 }).lean();
      if (!existing) return { message: "not_found", values };
      // A corrected expiry date restarts the 90/60/30-day warnings for this batch.
      const expiryChanged = new Date(existing.expiryDate).getTime() !== doc.expiryDate.getTime();
      await Listing.updateOne(
        { _id: listingId, sellerId: business._id },
        { $set: { ...doc, ...(expiryChanged ? { expiryAlertLevel: null } : {}) } },
      );
    } else {
      await Listing.create(doc);
    }
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { errors: { batchNo: "batch_exists" }, values };
    throw err;
  }
  after(() => checkPriceAlertsSafely([data.productId]));
  revalidatePath("/app/inventory");
  redirect("/app/inventory");
}

export async function setListingStatus(listingId: string, status: "active" | "paused") {
  const { business } = await requireSeller();
  if (!isValidObjectId(listingId) || (status !== "active" && status !== "paused")) return;
  await connectDB();
  // Listings held by an admin can't be resumed by the seller.
  const l = await Listing.findOneAndUpdate(
    { _id: listingId, sellerId: business._id, ...(status === "active" ? { "moderation.held": { $ne: true } } : {}) },
    { status },
    { projection: { productId: 1 } },
  ).lean();
  if (l) after(() => checkPriceAlertsSafely([l.productId]));
  revalidatePath("/app/inventory");
}

export async function updateStock(listingId: string, stock: number) {
  const { business } = await requireSeller();
  if (!isValidObjectId(listingId) || !Number.isInteger(stock) || stock < 0 || stock > 1_000_000) return { error: "invalid" };
  await connectDB();
  const l = await Listing.findOneAndUpdate({ _id: listingId, sellerId: business._id }, { stock }, { projection: { productId: 1 } }).lean();
  // Going in or out of stock can change the best price.
  if (l) after(() => checkPriceAlertsSafely([l.productId]));
  revalidatePath("/app/inventory");
  return { ok: true };
}

export async function deleteListing(listingId: string) {
  const { business } = await requireSeller();
  if (!isValidObjectId(listingId)) return;
  await connectDB();
  // Safe even with open orders: orders keep a frozen copy of each line item.
  const l = await Listing.findOneAndDelete({ _id: listingId, sellerId: business._id }, { projection: { productId: 1 } }).lean();
  if (l) after(() => checkPriceAlertsSafely([l.productId]));
  revalidatePath("/app/inventory");
}

export type NewProductState = { ok?: boolean; errors?: Record<string, string>; product?: { id: string; name: string; mrp: number } };

/** Lets a seller add a medicine that isn't in the master yet. */
export async function createSellerProduct(_: NewProductState, formData: FormData): Promise<NewProductState> {
  const { business } = await requireSeller();
  const ingredients = [0, 1, 2, 3]
    .map((i) => ({ salt: String(formData.get(`salt${i}`) ?? ""), strength: String(formData.get(`strength${i}`) ?? "") }))
    .filter((i) => i.salt.trim());
  const parsed = sellerProductSchema.safeParse({
    name: formData.get("name"),
    manufacturer: formData.get("manufacturer"),
    form: formData.get("form"),
    packSizeLabel: formData.get("packSizeLabel"),
    mrp: formData.get("mrp"),
    ingredients,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const p = parsed.data;

  await connectDB();
  const existing = await Product.findOne({ name: p.name, active: true }).collation(NAME_COLLATION).lean();
  if (existing) return { ok: true, product: { id: String(existing._id), name: existing.name, mrp: existing.mrp ?? 0 } };

  const salts = [...new Set(p.ingredients.map((i) => saltKeyOf(i.salt)))];
  const conditions = await Condition.find({ salts: { $in: salts }, active: true }, { slug: 1 }).lean();
  const created = await Product.create({
    ...p,
    ...compositionKeys(p.ingredients),
    salts,
    conditions: conditions.map((c) => c.slug),
    hsn: "3004",
    gstRate: 5,
    source: "seller",
    createdByBusinessId: business._id,
  });
  return { ok: true, product: { id: String(created._id), name: created.name, mrp: created.mrp ?? 0 } };
}

// ---------------------------------------------------------------- CSV import

export type CsvRowError = { row: number; field: string; code: string };
export type CsvImportState = { ok?: boolean; created?: number; updated?: number; errors?: CsvRowError[]; message?: string };

const CSV_MAX_BYTES = 1024 * 1024;
const CSV_MAX_ROWS = 2000;

/**
 * Columns: product_id | product_name, batch_no, expiry_date, mfg_date, mrp,
 * price, gst_rate, hsn, stock, min_order_qty, storage, schedule.
 * Rows are upserted by (product, batch): re-importing updates price and stock.
 */
export async function importListingsCsv(_: CsvImportState, formData: FormData): Promise<CsvImportState> {
  const { business } = await requireSeller();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "csv_missing" };
  if (file.size > CSV_MAX_BYTES) return { message: "csv_too_large" };

  let rows: Record<string, string>[];
  try {
    rows = parse(Buffer.from(await file.arrayBuffer()), {
      columns: (h: string[]) => h.map((c) => c.trim().toLowerCase().replace(/\s+/g, "_")),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch {
    return { message: "csv_unreadable" };
  }
  if (rows.length > CSV_MAX_ROWS) return { message: "csv_too_many_rows" };

  await connectDB();
  const errors: CsvRowError[] = [];

  // Resolve product names in one query (case-insensitive exact match).
  const names = [...new Set(rows.filter((r) => !r.product_id && r.product_name).map((r) => r.product_name))];
  const byName = new Map<string, string>();
  if (names.length) {
    const found = await Product.find({ name: { $in: names }, active: true }, { name: 1 }).collation(NAME_COLLATION).lean();
    for (const p of found) byName.set(p.name.toLowerCase(), String(p._id));
  }

  const valid: { row: number; data: ReturnType<typeof listingSchema.parse> }[] = [];
  for (const [i, r] of rows.entries()) {
    const rowNo = i + 2; // header is row 1
    const productId = r.product_id?.trim() || byName.get((r.product_name ?? "").toLowerCase()) || "";
    if (!productId) {
      errors.push({ row: rowNo, field: "product_name", code: "product_not_found" });
      continue;
    }
    const expiry = parseFlexibleDate(r.expiry_date ?? "");
    const mfg = parseFlexibleDate(r.mfg_date ?? "");
    const parsed = listingSchema.safeParse({
      productId,
      batchNo: r.batch_no ?? "",
      expiryDate: expiry ?? "invalid",
      mfgDate: mfg ? mfg.toISOString().slice(0, 10) : "",
      mrp: r.mrp,
      price: r.price,
      gstRate: r.gst_rate || "5",
      hsn: r.hsn || "3004",
      stock: r.stock,
      minOrderQty: r.min_order_qty || "1",
      storage: r.storage || "room",
      schedule: (r.schedule || "").toLowerCase(),
    });
    if (!parsed.success) {
      const [field, code] = Object.entries(fieldErrors(parsed.error))[0];
      errors.push({ row: rowNo, field, code });
      continue;
    }
    valid.push({ row: rowNo, data: parsed.data });
  }

  // product_id values supplied directly must point at real, active products.
  const ids = [...new Set(valid.map((v) => v.data.productId))];
  const existing = new Set(
    (await Product.find({ _id: { $in: ids }, active: true }, { _id: 1 }).lean()).map((p) => String(p._id)),
  );
  const ops = valid.flatMap(({ row, data }) => {
    if (!existing.has(data.productId)) {
      errors.push({ row, field: "product_id", code: "product_not_found" });
      return [];
    }
    const productId = new Types.ObjectId(data.productId);
    return [
      {
        updateOne: {
          filter: { sellerId: business._id, productId, batchNo: data.batchNo },
          update: { $set: { ...data, productId, sellerId: business._id, sellerStateCode: business.address!.stateCode } },
          upsert: true,
        },
      },
    ];
  });

  let created = 0;
  let updated = 0;
  if (ops.length) {
    const res = await Listing.bulkWrite(ops, { ordered: false });
    created = res.upsertedCount;
    updated = res.modifiedCount;
    after(() => checkPriceAlertsSafely(ids));
  }
  revalidatePath("/app/inventory");
  errors.sort((x, y) => x.row - y.row);
  return { ok: true, created, updated, errors: errors.slice(0, 50) };
}
