"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { checkPriceAlertsSafely } from "@/lib/alerts/price";
import { saltKeyOf } from "@/lib/catalog/normalize";
import { connectDB, mongoDb } from "@/lib/db/mongo";
import { Banner, BANNER_AUDIENCES, BANNER_TONES } from "@/lib/models/banner";
import { Message } from "@/lib/models/chat";
import { Condition } from "@/lib/models/condition";
import { Listing } from "@/lib/models/listing";
import { Product } from "@/lib/models/product";
import { PLATFORM_ROLES } from "@/lib/auth";
import { requirePlatformRole } from "@/lib/session";

export type AdminFormState = { ok?: boolean; error?: string };

const requireAdmin = () => requirePlatformRole("admin");

// ---------------------------------------------------------------- users

export async function setUserRole(userId: string, role: string) {
  const session = await requireAdmin();
  const parsed = z.enum(PLATFORM_ROLES).safeParse(role);
  if (!parsed.success || !ObjectId.isValid(userId) || userId === session.user.id) return { error: "invalid" };
  await mongoDb().collection("user").updateOne({ _id: new ObjectId(userId) }, { $set: { platformRole: parsed.data } });
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Banning also deletes the user's sessions so they're signed out everywhere. */
export async function setUserBanned(userId: string, banned: boolean) {
  const session = await requireAdmin();
  if (!ObjectId.isValid(userId) || userId === session.user.id) return { error: "invalid" };
  const db = mongoDb();
  await db.collection("user").updateOne({ _id: new ObjectId(userId) }, { $set: { banned } });
  if (banned) await db.collection("session").deleteMany({ userId: new ObjectId(userId) });
  revalidatePath("/admin/users");
  return { ok: true };
}

// ---------------------------------------------------------------- listings

export async function holdListing(listingId: string, reason: string) {
  const session = await requireAdmin();
  if (!isValidObjectId(listingId) || !reason.trim()) return { error: "remarks_required" };
  await connectDB();
  const l = await Listing.findByIdAndUpdate(
    listingId,
    { $set: { status: "paused", moderation: { held: true, reason: reason.trim().slice(0, 300), by: session.user.id, at: new Date() } } },
    { projection: { productId: 1 } },
  ).lean();
  if (l) after(() => checkPriceAlertsSafely([l.productId]));
  revalidatePath("/admin/listings");
  return { ok: true };
}

/** Releases the hold; the seller decides when to make it active again. */
export async function releaseListing(listingId: string) {
  await requireAdmin();
  if (!isValidObjectId(listingId)) return { error: "invalid" };
  await connectDB();
  await Listing.updateOne({ _id: listingId }, { $set: { "moderation.held": false } });
  revalidatePath("/admin/listings");
  return { ok: true };
}

// ---------------------------------------------------------------- reported messages

export async function moderateMessage(messageId: string, decision: "hide" | "dismiss") {
  await requireAdmin();
  if (!isValidObjectId(messageId) || (decision !== "hide" && decision !== "dismiss")) return;
  await connectDB();
  await Message.updateOne({ _id: messageId }, decision === "hide" ? { $set: { hidden: true } } : { $set: { reports: [] } });
  revalidatePath("/admin/reports");
}

// ---------------------------------------------------------------- condition tags

const conditionSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "invalid"),
  en: z.string().trim().min(2).max(60),
  hi: z.string().trim().max(60).optional(),
  mr: z.string().trim().max(60).optional(),
  salts: z.string().max(4000),
  active: z.boolean(),
});

/**
 * Creates/updates a condition tag and re-tags the catalog: products containing
 * any listed salt get the tag, products that no longer match lose it.
 */
export async function saveCondition(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const parsed = conditionSchema.safeParse({
    slug: formData.get("slug"),
    en: formData.get("en"),
    hi: formData.get("hi") || undefined,
    mr: formData.get("mr") || undefined,
    salts: formData.get("salts") ?? "",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: "invalid" };
  const { slug, en, hi, mr, active } = parsed.data;
  const salts = [...new Set(parsed.data.salts.split(/[\n,]/).map(saltKeyOf).filter(Boolean))].slice(0, 300);

  await connectDB();
  await Condition.updateOne({ slug }, { $set: { name: { en, hi, mr }, salts, active } }, { upsert: true });
  // Full scan of `products` (no index on salts, to save space) — fine for an occasional admin edit.
  await Product.updateMany({ salts: { $in: salts }, conditions: { $ne: slug } }, { $addToSet: { conditions: slug } });
  await Product.updateMany({ conditions: slug, salts: { $nin: salts } }, { $pull: { conditions: slug } });
  revalidatePath("/admin/conditions");
  revalidatePath("/app/catalog");
  return { ok: true };
}

// ---------------------------------------------------------------- banners

const bannerSchema = z.object({
  titleEn: z.string().trim().min(2).max(120),
  titleHi: z.string().trim().max(120).optional(),
  titleMr: z.string().trim().max(120).optional(),
  bodyEn: z.string().trim().max(400).optional(),
  bodyHi: z.string().trim().max(400).optional(),
  bodyMr: z.string().trim().max(400).optional(),
  link: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || v.startsWith("/") || /^https:\/\//.test(v), "invalid")
    .optional(),
  audience: z.enum(BANNER_AUDIENCES),
  tone: z.enum(BANNER_TONES),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export async function createBanner(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const session = await requireAdmin();
  const raw = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, typeof v === "string" && v ? v : undefined]));
  const parsed = bannerSchema.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };
  const b = parsed.data;
  const date = (v?: string) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v) : undefined);
  await connectDB();
  await Banner.create({
    title: { en: b.titleEn, hi: b.titleHi, mr: b.titleMr },
    body: { en: b.bodyEn, hi: b.bodyHi, mr: b.bodyMr },
    link: b.link,
    audience: b.audience,
    tone: b.tone,
    startsAt: date(b.startsAt),
    endsAt: date(b.endsAt),
    createdBy: session.user.id,
  });
  revalidatePath("/admin/banners");
  return { ok: true };
}

export async function setBannerActive(bannerId: string, active: boolean) {
  await requireAdmin();
  if (!isValidObjectId(bannerId)) return;
  await connectDB();
  await Banner.updateOne({ _id: bannerId }, { $set: { active } });
  revalidatePath("/admin/banners");
}

export async function deleteBanner(bannerId: string) {
  await requireAdmin();
  if (!isValidObjectId(bannerId)) return;
  await connectDB();
  await Banner.deleteOne({ _id: bannerId });
  revalidatePath("/admin/banners");
}
