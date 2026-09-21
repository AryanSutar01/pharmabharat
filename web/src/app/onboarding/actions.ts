"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongo";
import { Business, DOCUMENT_KINDS } from "@/lib/models/business";
import { kycChecklist } from "@/lib/kyc";
import { Membership } from "@/lib/models/membership";
import { ACTIVE_BUSINESS_COOKIE, getBusinessContext, requireBusiness, requireUser } from "@/lib/session";
import {
  businessProfileSchema,
  createBusinessSchema,
  fieldErrors,
} from "@/lib/validation/business";
import { deleteKycAsset, signKycUpload, verifyKycAsset } from "@/lib/cloudinary";

export type FormState = {
  ok?: boolean;
  errors?: Record<string, string>;
  message?: string;
  /** Echo of submitted values so a failed submit doesn't wipe the form (React 19 resets forms after actions). */
  values?: ReturnType<typeof formToProfile>;
};

const EDITABLE = new Set(["draft", "rejected"]);

export async function createBusiness(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireUser();
  const parsed = createBusinessSchema.safeParse({
    type: formData.get("type"),
    legalName: formData.get("legalName"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await connectDB();
  const business = await Business.create({
    ...parsed.data,
    email: session.user.email,
    ownerUserId: session.user.id,
    kyc: { status: "draft" },
  });
  await Membership.create({ businessId: business._id, userId: session.user.id, role: "owner" });

  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, String(business._id), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/onboarding");
}

/** Converts the flat form (address.city, drugLicenses.0.number, ...) to nested input. */
function formToProfile(formData: FormData) {
  const get = (k: string) => (formData.get(k) as string | null) ?? "";
  const licenses = [0, 1, 2, 3]
    .map((i) => ({
      form: get(`drugLicenses.${i}.form`),
      number: get(`drugLicenses.${i}.number`),
      validTill: get(`drugLicenses.${i}.validTill`),
    }))
    .filter((l) => l.form || l.number || l.validTill);
  return {
    legalName: get("legalName"),
    tradeName: get("tradeName"),
    gstin: get("gstin"),
    pan: get("pan"),
    phone: get("phone").replace(/\D/g, "").slice(-10),
    email: get("email"),
    address: {
      line1: get("address.line1"),
      line2: get("address.line2"),
      city: get("address.city"),
      district: get("address.district"),
      stateCode: get("address.stateCode"),
      pincode: get("address.pincode"),
    },
    drugLicenses: licenses,
    pharmacist: { name: get("pharmacist.name"), registrationNumber: get("pharmacist.registrationNumber") },
    fssaiNumber: get("fssaiNumber"),
  };
}

export async function saveBusinessProfile(_: FormState, formData: FormData): Promise<FormState> {
  const { business } = await requireBusiness({ permission: "business.edit", allowUnapproved: true });

  const values = formToProfile(formData);
  if (!EDITABLE.has(business.kyc?.status ?? "draft")) return { message: "locked", values };
  const parsed = businessProfileSchema.safeParse({ type: business.type, ...values });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const data: Partial<typeof parsed.data> = { ...parsed.data };
  delete data.type;
  if (business.type !== "retailer") delete data.pharmacist;

  await connectDB();
  const clash = await Business.exists({ gstin: data.gstin, _id: { $ne: business._id } });
  if (clash) return { errors: { gstin: "gstin_taken" }, values };

  await Business.updateOne({ _id: business._id }, { $set: data });
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function getKycUploadSignature() {
  const { business } = await requireBusiness({ permission: "business.edit", allowUnapproved: true });
  if (!EDITABLE.has(business.kyc?.status ?? "draft")) throw new Error("locked");
  return signKycUpload(String(business._id));
}

const attachSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  publicId: z.string().min(1).max(300),
  originalName: z.string().max(200).optional(),
});

export async function attachDocument(input: z.input<typeof attachSchema>): Promise<FormState> {
  const { business, session } = await requireBusiness({ permission: "business.edit", allowUnapproved: true });
  if (!EDITABLE.has(business.kyc?.status ?? "draft")) return { message: "locked" };
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { message: "invalid" };

  const asset = await verifyKycAsset(String(business._id), parsed.data.publicId);
  if (!asset) return { message: "upload_failed" };

  await connectDB();
  await Business.updateOne(
    { _id: business._id },
    {
      $push: {
        documents: {
          kind: parsed.data.kind,
          publicId: asset.publicId,
          resourceType: "image",
          format: asset.format,
          bytes: asset.bytes,
          originalName: parsed.data.originalName,
          uploadedBy: session.user.id,
        },
      },
    },
  );
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function removeDocument(documentId: string): Promise<FormState> {
  const { business } = await requireBusiness({ permission: "business.edit", allowUnapproved: true });
  if (!EDITABLE.has(business.kyc?.status ?? "draft")) return { message: "locked" };
  const doc = business.documents.find((d) => String(d._id) === documentId);
  if (!doc) return { message: "not_found" };

  await connectDB();
  await Business.updateOne({ _id: business._id }, { $pull: { documents: { _id: doc._id } } });
  await deleteKycAsset(doc.publicId).catch((err) => console.error("[kyc] cloudinary delete failed", err));
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function submitForReview(): Promise<FormState> {
  const { business } = await requireBusiness({ permission: "business.edit", allowUnapproved: true });
  if (!EDITABLE.has(business.kyc?.status ?? "draft")) return { message: "locked" };
  const check = kycChecklist(business);
  if (!check.profileComplete) return { message: "profile_incomplete" };
  if (check.missingDocuments.length) return { message: "documents_missing" };

  await connectDB();
  await Business.updateOne(
    { _id: business._id },
    { $set: { "kyc.status": "pending", "kyc.submittedAt": new Date() }, $unset: { "kyc.remarks": "" } },
  );
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function switchBusiness(businessId: string) {
  const { memberships } = await getBusinessContext();
  if (!memberships.some((m) => String(m.businessId) === businessId)) return;
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, businessId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/app");
}
