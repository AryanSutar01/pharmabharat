import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NavIcon } from "@/components/app-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, PageHeader } from "@/components/ui";
import { getNav } from "@/lib/nav";

export const metadata = { title: "More" };

/** Phone menu: every section that doesn't fit in the 5-slot bottom bar. */
export default async function MorePage() {
  const { items } = await getNav();
  const t = await getTranslations();
  const rest = items.filter((i) => !i.mobile);

  return (
    <>
      <PageHeader title={t("nav.more")} />
      <Card>
        <ul className="divide-y divide-line">
          {rest.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas">
                <NavIcon name={i.icon} className="text-muted" />
                <span className="flex-1 text-sm font-medium">{i.label}</span>
                {i.badge ? (
                  <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold leading-5 text-white">{i.badge}</span>
                ) : null}
                <span className="text-muted" aria-hidden>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <div className="mt-5 flex items-center justify-between px-1">
        <LanguageSwitcher />
        <SignOutButton />
      </div>
    </>
  );
}
