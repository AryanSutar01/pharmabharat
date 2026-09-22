"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  soon?: boolean;
  mobile?: boolean;
  badge?: number;
};

const ICONS = {
  home: "M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1z",
  catalog: "M8.5 14a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM12.5 12.5 17 17",
  inventory: "M3 6.5 10 3l7 3.5v7L10 17l-7-3.5zM3 6.5 10 10l7-3.5M10 10v7",
  orders: "M5 3h10l1 14H4zM8 7h4M8 10h4",
  cart: "M2.5 3.5h2l1.8 9h9l1.7-6.5H5.5M8 16.5a1 1 0 1 0 0-.01M14.5 16.5a1 1 0 1 0 0-.01",
  chat: "M4 5h12v8H9l-4 3v-3H4z",
  team: "M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2.5 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M13.5 9a2 2 0 1 0 0-4M13 12c2.2 0 4.5 1.3 4.5 4",
  business: "M3 17V7l7-3 7 3v10M7 17v-5h6v5M3 17h14",
  admin: "M10 2.5 16 5v5c0 3.5-2.6 6.4-6 7.5-3.4-1.1-6-4-6-7.5V5z",
} as const;

export function NavIcon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn("size-5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ items, soonLabel }: { items: NavItem[]; soonLabel: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-800" : "text-muted hover:bg-canvas hover:text-ink",
            )}
          >
            <NavIcon name={item.icon} />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold leading-5 text-white">{item.badge}</span>
            ) : null}
            {item.soon ? <span className="text-[10px] uppercase tracking-wide text-muted/70">{soonLabel}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Fixed bottom tab bar on phones — the primary navigation on small screens. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const visible = items.filter((i) => i.mobile);
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white lg:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
        {visible.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-brand-700" : "text-muted",
                )}
              >
                <NavIcon name={item.icon} className="size-6" />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
