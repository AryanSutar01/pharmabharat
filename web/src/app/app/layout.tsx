import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { BottomNav, NavIcon, SideNav, type NavItem } from "@/components/app-nav";
import { BusinessSwitcher } from "@/components/business-switcher";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/ui";
import { isSellerType } from "@/lib/catalog/seller";
import { cartCount } from "@/lib/orders/cart";
import { can } from "@/lib/permissions";
import { requireBusiness } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { business, role, memberships, session } = await requireBusiness();
  const t = await getTranslations();

  const seller = isSellerType(business.type) && can(role, "inventory.manage");
  const buyer = business.type !== "company" && can(role, "orders.place");
  const inCart = buyer ? await cartCount(business._id, session.user.id) : 0;
  // Bottom bar on phones holds at most 5 items; sellers get Inventory in place of Chat.
  const items: NavItem[] = [
    { href: "/app", label: t("nav.home"), icon: "home", mobile: true },
    { href: "/app/catalog", label: t("nav.catalog"), icon: "catalog", mobile: true },
    ...(seller ? [{ href: "/app/inventory", label: t("nav.inventory"), icon: "inventory" as const, mobile: true }] : []),
    ...(buyer ? [{ href: "/app/cart", label: t("nav.cart"), icon: "cart" as const, badge: inCart }] : []),
    { href: "/app/orders", label: t("nav.orders"), icon: "orders", mobile: true },
    { href: "/app/chat", label: t("nav.chat"), icon: "chat", mobile: !seller, soon: true },
    ...(can(role, "team.manage") ? [{ href: "/app/team", label: t("nav.team"), icon: "team" as const }] : []),
    { href: "/app/business", label: t("nav.business"), icon: "business", mobile: true },
    ...(session.user.platformRole === "admin"
      ? [{ href: "/admin", label: t("nav.admin"), icon: "admin" as const }]
      : []),
  ];

  const businessName = business.tradeName || business.legalName;
  const options = memberships.map((m) => ({
    id: String(m.businessId),
    name: m.business.tradeName || m.business.legalName,
    type: m.business.type,
  }));

  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="px-5 py-4">
          <Link href="/app">
            <Logo />
          </Link>
        </div>
        <div className="border-y border-line px-4 py-3">
          <p className="truncate text-sm font-semibold">{businessName}</p>
          <p className="mb-2 text-xs text-muted">
            {t(`businessType.${business.type}`)} · {t(`role.${role}`)}
          </p>
          <BusinessSwitcher current={String(business._id)} options={options} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <SideNav items={items} soonLabel={t("common.comingSoon")} />
        </div>
        <div className="space-y-3 border-t border-line px-4 py-3">
          <UserChip name={session.user.name} email={session.user.email} image={session.user.image} />
          <div className="flex items-center justify-between">
            <LanguageSwitcher />
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{businessName}</p>
            <p className="text-xs text-muted">{t(`role.${role}`)}</p>
          </div>
          <div className="flex items-center gap-3">
            {buyer ? (
              <Link href="/app/cart" className="relative p-1 text-ink" aria-label={t("nav.cart")}>
                <NavIcon name="cart" className="size-6" />
                {inCart ? (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-brand-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                    {inCart}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <LanguageSwitcher />
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-10 lg:pt-8">{children}</main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}

function UserChip({ name, email, image }: { name: string; email: string; image?: string | null }) {
  return (
    <div className="flex items-center gap-2.5">
      {image ? (
        <Image src={image} alt="" width={32} height={32} className="size-8 rounded-full" />
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted">{email}</p>
      </div>
    </div>
  );
}
