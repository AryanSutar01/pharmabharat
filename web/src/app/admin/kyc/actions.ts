"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { requirePlatformRole } from "@/lib/session";
import { getUsersByIds } from "@/lib/users";
import { sendMail } from "@/lib/mail";
import { kycDecisionEmail } from "@/lib/mail/templates";

export type DecisionState = { ok?: boolean; error?: string };

const schema = z.object({
  decision: z.enum(["approve", "reject", "suspend", "reinstate"]),
  remarks: z.string().trim().max(2000).optional(),
});

/** Which statuses each decision may be applied from. */
const TRANSITIONS = {
  approve: { from: ["pending"], to: "approved" },
  reject: { from: ["pending"], to: "rejected" },
  suspend: { from: ["approved"], to: "suspended" },
  reinstate: { from: ["suspended"], to: "approved" },
} as const;

export async function decideKyc(businessId: string, _: DecisionState, formData: FormData): Promise<DecisionState> {
  const session = await requirePlatformRole("admin");
  if (!isValidObjectId(businessId)) return { error: "not_found" };
  const parsed = schema.safeParse({ decision: formData.get("decision"), remarks: formData.get("remarks") ?? undefined });
  if (!parsed.success) return { error: "invalid" };
  const { decision, remarks } = parsed.data;
  if ((decision === "reject" || decision === "suspend") && !remarks) return { error: "remarks_required" };

  const { from, to } = TRANSITIONS[decision];
  await connectDB();
  const set = { "kyc.status": to, "kyc.reviewedAt": new Date(), "kyc.reviewedBy": session.user.id };
  const business = await Business.findOneAndUpdate(
    { _id: businessId, "kyc.status": { $in: from } },
    remarks ? { $set: { ...set, "kyc.remarks": remarks } } : { $set: set, $unset: { "kyc.remarks": "" } },
    { returnDocument: "after" },
  ).lean();
  if (!business) return { error: "invalid" };

  if (decision === "approve" || decision === "reject") {
    const owner = (await getUsersByIds([business.ownerUserId])).get(business.ownerUserId);
    const to = [owner?.email, business.email].filter((e): e is string => Boolean(e));
    const mail = kycDecisionEmail({
      businessName: business.tradeName || business.legalName,
      approved: decision === "approve",
      remarks,
    });
    for (const addr of new Set(to)) await sendMail({ to: addr, ...mail });
  }

  revalidatePath("/admin/kyc");
  revalidatePath(`/admin/kyc/${businessId}`);
  return { ok: true };
}
