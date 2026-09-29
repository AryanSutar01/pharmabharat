import "server-only";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/session";
import { collectsGst } from "@/lib/tax-status";

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
  // Selling here means issuing a tax invoice, which a composition or
  // unregistered business may not do — they may buy, and run their own shop.
  if (!collectsGst(ctx.business.taxStatus)) redirect("/app/business?sell=gst_required");
  return ctx;
}
