"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB, mongoClient } from "@/lib/db/mongo";
import { Invitation, Membership } from "@/lib/models/membership";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { requireBusiness } from "@/lib/session";
import { sendMail } from "@/lib/mail";
import { inviteEmail } from "@/lib/mail/templates";
import { hashToken, newToken } from "@/lib/tokens";

export type TeamFormState = { ok?: boolean; error?: string; email?: string };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const inviteSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: z.enum(ASSIGNABLE_ROLES),
});

export async function inviteMember(_: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const { business, session } = await requireBusiness({ permission: "team.manage" });
  const parsed = inviteSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: "invalid_email" };
  const { email, role } = parsed.data;

  await connectDB();
  const existingUser = await mongoClient().db().collection("user").findOne({ email }, { projection: { _id: 1 } });
  if (existingUser && (await Membership.exists({ businessId: business._id, userId: String(existingUser._id) }))) {
    return { error: "already_member" };
  }
  if (await Invitation.exists({ businessId: business._id, email, status: "pending", expiresAt: { $gt: new Date() } })) {
    return { error: "invite_exists" };
  }

  const token = newToken();
  await Invitation.create({
    businessId: business._id,
    email,
    role,
    tokenHash: hashToken(token),
    invitedBy: session.user.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  await sendMail({
    to: email,
    ...inviteEmail({
      businessName: business.tradeName || business.legalName,
      inviterName: session.user.name,
      role,
      token,
    }),
  });

  revalidatePath("/app/team");
  return { ok: true, email };
}

export async function revokeInvite(inviteId: string) {
  const { business } = await requireBusiness({ permission: "team.manage" });
  if (!isValidObjectId(inviteId)) return;
  await connectDB();
  await Invitation.updateOne({ _id: inviteId, businessId: business._id, status: "pending" }, { status: "revoked" });
  revalidatePath("/app/team");
}

export async function changeMemberRole(membershipId: string, role: string) {
  const { business } = await requireBusiness({ permission: "team.manage" });
  const parsed = z.enum(ASSIGNABLE_ROLES).safeParse(role);
  if (!parsed.success || !isValidObjectId(membershipId)) return { error: "invalid" };
  await connectDB();
  // Owner's role is never changed here (filter excludes it).
  await Membership.updateOne({ _id: membershipId, businessId: business._id, role: { $ne: "owner" } }, { role: parsed.data });
  revalidatePath("/app/team");
  return { ok: true };
}

export async function setMemberStatus(membershipId: string, status: "active" | "disabled") {
  const { business } = await requireBusiness({ permission: "team.manage" });
  if ((status !== "active" && status !== "disabled") || !isValidObjectId(membershipId)) return;
  await connectDB();
  await Membership.updateOne({ _id: membershipId, businessId: business._id, role: { $ne: "owner" } }, { status });
  revalidatePath("/app/team");
}
