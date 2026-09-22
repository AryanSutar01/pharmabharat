import "server-only";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/session";

/** Business types that can list stock for sale (pharma companies sell via distributors). */
export const SELLER_TYPES = ["wholesaler"] as const;

export function isSellerType(type: string) {
  return (SELLER_TYPES as readonly string[]).includes(type);
}

/** Guard for inventory pages/actions: approved seller business + inventory.manage. */
export async function requireSeller() {
  const ctx = await requireBusiness({ permission: "inventory.manage" });
  if (!isSellerType(ctx.business.type)) redirect("/403");
  if (!ctx.business.address?.stateCode) redirect("/app/business");
  return ctx;
}
