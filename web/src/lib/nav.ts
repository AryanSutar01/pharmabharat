import "server-only";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import type { NavItem } from "@/components/app-nav";
import { isSellerType } from "@/lib/catalog/seller";
import { unreadDirectCount } from "@/lib/chat/service";
import { unreadCount } from "@/lib/notifications";
import { cartCount } from "@/lib/orders/cart";
import { can } from "@/lib/permissions";
import { requireBusiness } from "@/lib/session";

/**
 * Every section the current user can reach, in display order. Used by the
 * desktop sidebar, the phone bottom bar (items with `mobile`) and /app/more.
 */
export const getNav = cache(async () => {
  const { business, role, session } = await requireBusiness();
  const t = await getTranslations();

  const seller = isSellerType(business.type) && can(role, "inventory.manage");
  const buyer = business.type !== "company" && can(role, "orders.place");
  const canChat = can(role, "chat.use");
  const staff = ["support", "admin"].includes(session.user.platformRole as string);
  const [inCart, unread, unreadChats] = await Promise.all([
    buyer ? cartCount(business._id, session.user.id) : 0,
    unreadCount(session.user.id, business._id),
    canChat ? unreadDirectCount(business) : 0,
  ]);

  // Phone bottom bar: 5 slots. Sellers get Inventory in place of Chat; "More" holds the rest.
  const items: NavItem[] = [
    { href: "/app", label: t("nav.home"), icon: "home", mobile: true },
    { href: "/app/catalog", label: t("nav.catalog"), icon: "catalog", mobile: true },
    ...(seller ? [{ href: "/app/inventory", label: t("nav.inventory"), icon: "inventory" as const, mobile: true }] : []),
    ...(buyer ? [{ href: "/app/cart", label: t("nav.cart"), icon: "cart" as const, badge: inCart }] : []),
    { href: "/app/orders", label: t("nav.orders"), icon: "orders", mobile: true },
    ...(canChat ? [{ href: "/app/chat", label: t("nav.chat"), icon: "chat" as const, mobile: !seller, badge: unreadChats }] : []),
    { href: "/app/notifications", label: t("nav.notifications"), icon: "bell", badge: unread },
    { href: "/app/alerts", label: t("nav.alerts"), icon: "alert" },
    ...(can(role, "team.manage") ? [{ href: "/app/team", label: t("nav.team"), icon: "team" as const }] : []),
    { href: "/app/business", label: t("nav.business"), icon: "business" },
    { href: "/app/support", label: t("nav.support"), icon: "help" },
    ...(staff ? [{ href: "/support-desk", label: t("nav.supportDesk"), icon: "desk" as const }] : []),
    ...(session.user.platformRole === "admin" ? [{ href: "/admin", label: t("nav.admin"), icon: "admin" as const }] : []),
  ];

  const more: NavItem = { href: "/app/more", label: t("nav.more"), icon: "more", mobile: true };
  return { items, bottom: [...items.filter((i) => i.mobile), more], buyer, inCart, unread };
});
