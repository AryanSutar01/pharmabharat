import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NavIcon } from "@/components/app-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, PageHeader } from "@/components/ui";
import { BusinessSwitcher } from "@/components/business-switcher";
import { getNav } from "@/lib/nav";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "More" };

/** Phone menu: every section that doesn't fit in the 5-slot bottom bar. */
export default async function MorePage() {
  const { items } = await getNav();
  const { business, role, memberships } = await requireBusiness();
  const t = await getTranslations();
  const options = memberships.map((m) => ({ id: String(m.businessId), name: m.business.tradeName || m.business.legalName, type: m.business.type }));
  const rest = items.filter((i) => !i.mobile);

  return (
    <>
      <PageHeader title={t("nav.more")} />
      {/* Phones have no sidebar, so the business switcher lives here. */}
      <Card className="mb-4 p-4">
        <BusinessSwitcher
          current={String(business._id)}
          options={options}
          subtitle={`${t(`businessType.${business.type}`)} · ${t(`role.${role}`)}`}
        />
      </Card>
      {[...new Set(rest.map((i) => i.section))].map((section) => (
      <section key={section} className="mb-4">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{section}</h2>
      <Card>
        <ul className="divide-y divide-line">
          {rest.filter((i) => i.section === section).map((i) => (
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
      </section>
      ))}
      <div className="mt-5 flex items-center justify-between px-1">
        <LanguageSwitcher />
        <SignOutButton />
      </div>
    </>
  );
}
