import { requiredDocuments, type BusinessDoc } from "@/lib/models/business";
import { businessProfileSchema } from "@/lib/validation/business";

/** What is still missing before a business can be submitted for review. */
export function kycChecklist(business: BusinessDoc) {
  const profile = businessProfileSchema.safeParse({
    ...business,
    tradeName: business.tradeName ?? "",
    fssaiNumber: business.fssaiNumber ?? "",
  });
  const uploaded = new Set(business.documents.map((d) => d.kind));
  const missingDocuments = requiredDocuments(business.type, business.taxStatus).filter((k) => !uploaded.has(k));
  return { profileComplete: profile.success, missingDocuments };
}
