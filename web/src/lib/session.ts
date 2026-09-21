import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type PlatformRole } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Membership, type MembershipDoc } from "@/lib/models/membership";
import { can, type MemberRole, type Permission } from "@/lib/permissions";

export const ACTIVE_BUSINESS_COOKIE = "pb_business";

export const getSession = cache(async () => auth().api.getSession({ headers: await headers() }));

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export async function requirePlatformRole(...roles: PlatformRole[]) {
  const session = await requireUser();
  if (!roles.includes(session.user.platformRole as PlatformRole)) redirect("/403");
  return session;
}

export type BusinessContext = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  memberships: (MembershipDoc & { business: BusinessDoc })[];
  membership: MembershipDoc | null;
  business: BusinessDoc | null;
  role: MemberRole | null;
};

/**
 * The signed-in user plus the business they are currently acting for.
 * A user can belong to several businesses; the active one is remembered in a
 * cookie and always re-validated against their memberships.
 */
export const getBusinessContext = cache(async (): Promise<BusinessContext> => {
  const session = await requireUser();
  await connectDB();

  const rows = await Membership.find({ userId: session.user.id, status: "active" }).lean();
  const businesses = await Business.find({ _id: { $in: rows.map((r) => r.businessId) } }).lean();
  const byId = new Map(businesses.map((b) => [String(b._id), b]));
  const memberships = rows
    .filter((r) => byId.has(String(r.businessId)))
    .map((r) => ({ ...r, business: byId.get(String(r.businessId))! }));

  const chosen = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
  const active = memberships.find((m) => String(m.businessId) === chosen) ?? memberships[0] ?? null;

  return {
    session,
    memberships,
    membership: active,
    business: active?.business ?? null,
    role: (active?.role as MemberRole) ?? null,
  };
});

/**
 * Guard for pages/actions that act on behalf of a business.
 * - no business yet            → onboarding
 * - KYC not approved           → onboarding status page (unless allowUnapproved)
 * - missing permission         → /403
 */
export async function requireBusiness(opts: { permission?: Permission; allowUnapproved?: boolean } = {}) {
  const ctx = await getBusinessContext();
  if (!ctx.business || !ctx.role) redirect("/onboarding");
  if (!opts.allowUnapproved && ctx.business.kyc?.status !== "approved") redirect("/onboarding");
  if (opts.permission && !can(ctx.role, opts.permission)) redirect("/403");
  return ctx as BusinessContext & { business: BusinessDoc; role: MemberRole; membership: MembershipDoc };
}
