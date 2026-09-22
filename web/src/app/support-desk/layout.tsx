import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/ui";
import { requirePlatformRole } from "@/lib/session";
import { DeskTabs } from "./desk-tabs";

export default async function SupportDeskLayout({ children }: LayoutProps<"/support-desk">) {
  const session = await requirePlatformRole("support", "admin");
  const t = await getTranslations();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/support-desk">
              <Logo />
            </Link>
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {t("desk.title")}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {session.user.platformRole === "admin" ? (
              <Link href="/admin" className="hidden text-sm text-muted hover:text-ink sm:inline">
                {t("nav.admin")}
              </Link>
            ) : null}
            <LanguageSwitcher />
            <SignOutButton />
          </div>
        </div>
        <DeskTabs labels={{ tickets: t("desk.tickets"), chat: t("desk.liveChat") }} />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
