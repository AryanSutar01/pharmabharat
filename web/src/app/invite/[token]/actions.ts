"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/mongo";
import { Invitation, Membership } from "@/lib/models/membership";
import { ACTIVE_BUSINESS_COOKIE, requireUser } from "@/lib/session";
import { hashToken } from "@/lib/tokens";

export async function acceptInvite(token: string) {
  const session = await requireUser();
  await connectDB();

  // Atomically claim the invite so it can't be accepted twice.
  const invite = await Invitation.findOneAndUpdate(
    {
      tokenHash: hashToken(token),
      status: "pending",
      expiresAt: { $gt: new Date() },
      email: session.user.email.toLowerCase(),
    },
    { status: "accepted", acceptedBy: session.user.id },
    { new: true },
  ).lean();
  if (!invite) redirect(`/invite/${encodeURIComponent(token)}`);

  const existing = await Membership.findOne({ businessId: invite.businessId, userId: session.user.id });
  if (existing) {
    // Re-activates a previously disabled member; never downgrades an owner.
    existing.status = "active";
    if (existing.role !== "owner") existing.role = invite.role;
    await existing.save();
  } else {
    await Membership.create({
      businessId: invite.businessId,
      userId: session.user.id,
      role: invite.role,
      invitedBy: invite.invitedBy,
    });
  }

  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, String(invite.businessId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/app");
}
