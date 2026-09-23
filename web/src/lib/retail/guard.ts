import "server-only";
import { redirect } from "next/navigation";
import type { Permission } from "@/lib/permissions";
import { requireBusiness } from "@/lib/session";

/**
 * The shop module belongs to retailers: a wholesaler's stock is its listings,
 * not a shelf. Everything under /app/shop goes through this.
 */
export async function requireShop(permission: Extract<Permission, "retail.sell" | "retail.manage"> = "retail.manage") {
  const ctx = await requireBusiness({ permission });
  if (ctx.business.type !== "retailer") redirect("/403");
  return ctx;
}
