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
  const shop = business.type === "retailer" && can(role, "retail.manage");
  const counter = business.type === "retailer" && can(role, "retail.sell");
  const buyer = business.type !== "company" && can(role, "orders.place");
  const canChat = can(role, "chat.use");
  const staff = ["support", "admin"].includes(session.user.platformRole as string);
  const [inCart, unread, unreadChats] = await Promise.all([
    buyer ? cartCount(business._id, session.user.id) : 0,
    unreadCount(session.user.id, business._id),
    canChat ? unreadDirectCount(business) : 0,
  ]);

  // Phone bottom bar: 5 slots. Sellers get Inventory in place of Chat; "More" holds the rest.
  const trade = t("nav.sectionTrade");
  const shopSection = t("nav.sectionShop");
  const account = t("nav.sectionAccount");
  const platform = t("nav.sectionPlatform");
  const raw: NavItem[] = [
    { href: "/app", label: t("nav.home"), icon: "home", mobile: true },
    { href: "/app/catalog", label: t("nav.catalog"), icon: "catalog", mobile: true },
    ...(seller ? [{ href: "/app/inventory", label: t("nav.inventory"), icon: "inventory" as const, mobile: true }] : []),
    ...(buyer ? [{ href: "/app/cart", label: t("nav.cart"), icon: "cart" as const, badge: inCart }] : []),
    { href: "/app/orders", label: t("nav.orders"), icon: "orders", mobile: true },
    ...(can(role, "billing.view") ? [{ href: "/app/ledger", label: t("nav.ledger"), icon: "ledger" as const }] : []),
    ...(counter ? [{ href: "/app/shop/billing", label: t("nav.billing"), icon: "billing" as const, mobile: true }] : []),
    ...(shop ? [{ href: "/app/shop/stock", label: t("nav.shopStock"), icon: "shop" as const }] : []),
    ...(counter ? [{ href: "/app/shop/bills", label: t("nav.bills"), icon: "orders" as const }] : []),
    ...(shop ? [{ href: "/app/shop/customers", label: t("nav.customers"), icon: "team" as const }] : []),
    ...(shop ? [{ href: "/app/shop/alerts", label: t("nav.shopAlerts"), icon: "alert" as const }] : []),
    ...(canChat ? [{ href: "/app/chat", label: t("nav.chat"), icon: "chat" as const, mobile: !seller, badge: unreadChats }] : []),
    { href: "/app/notifications", label: t("nav.notifications"), icon: "bell", badge: unread },
    { href: "/app/alerts", label: t("nav.alerts"), icon: "alert" },
    ...(can(role, "team.manage") ? [{ href: "/app/team", label: t("nav.team"), icon: "team" as const }] : []),
    { href: "/app/business", label: t("nav.business"), icon: "business" },
    { href: "/app/support", label: t("nav.support"), icon: "help" },
    ...(staff ? [{ href: "/support-desk", label: t("nav.supportDesk"), icon: "desk" as const }] : []),
    ...(session.user.platformRole === "admin" ? [{ href: "/admin", label: t("nav.admin"), icon: "admin" as const }] : []),
  ];

  // Sidebar sections: trading first, then account/help, then platform staff tools.
  const sectionOf = (href: string) =>
    href.startsWith("/app/shop")
      ? shopSection
      : ["/support-desk", "/admin"].includes(href)
      ? platform
      : ["/app/notifications", "/app/alerts", "/app/team", "/app/business", "/app/support"].includes(href)
        ? account
        : trade;
  const items = raw.map((i) => ({ ...i, section: sectionOf(i.href) }));

  const more: NavItem = { href: "/app/more", label: t("nav.more"), icon: "more", mobile: true };
  return { items, bottom: [...items.filter((i) => i.mobile), more], buyer, inCart, unread };
});
