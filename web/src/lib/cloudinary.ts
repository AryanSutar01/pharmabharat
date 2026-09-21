import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

export function cloudinaryConfigured() {
  const e = env();
  return Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET);
}

function client() {
  const e = env();
  if (!cloudinaryConfigured()) throw new Error("Cloudinary is not configured (see .env.example)");
  cloudinary.config({
    cloud_name: e.CLOUDINARY_CLOUD_NAME,
    api_key: e.CLOUDINARY_API_KEY,
    api_secret: e.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export const KYC_MAX_BYTES = 5 * 1024 * 1024;
export const KYC_ALLOWED_FORMATS = ["pdf", "jpg", "jpeg", "png", "webp"];

export function kycFolder(businessId: string) {
  return `pharmabharat/kyc/${businessId}`;
}

/**
 * Signature for a direct browser → Cloudinary upload. Files are stored as
 * type "authenticated" so they can only be fetched through a signed URL.
 */
export function signKycUpload(businessId: string) {
  const c = client();
  const e = env();
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    timestamp,
    folder: kycFolder(businessId),
    type: "authenticated",
    allowed_formats: KYC_ALLOWED_FORMATS.join(","),
  };
  const signature = c.utils.api_sign_request(params, e.CLOUDINARY_API_SECRET!);
  return {
    ...params,
    signature,
    apiKey: e.CLOUDINARY_API_KEY!,
    uploadUrl: `https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}/image/upload`,
  };
}

/** Confirms the asset really exists in our folder (guards against forged ids). */
export async function verifyKycAsset(businessId: string, publicId: string) {
  if (!publicId.startsWith(`${kycFolder(businessId)}/`)) return null;
  try {
    const r = await client().api.resource(publicId, { type: "authenticated", resource_type: "image" });
    if (r.bytes > KYC_MAX_BYTES) return null;
    return { publicId: r.public_id as string, format: r.format as string, bytes: r.bytes as number };
  } catch {
    return null;
  }
}

/** Short-lived download link for an authenticated asset. */
export function kycDownloadUrl(publicId: string, format: string) {
  return client().utils.private_download_url(publicId, format, {
    type: "authenticated",
    resource_type: "image",
    expires_at: Math.round(Date.now() / 1000) + 10 * 60,
  });
}

export async function deleteKycAsset(publicId: string) {
  await client().uploader.destroy(publicId, { type: "authenticated", resource_type: "image", invalidate: true });
}
