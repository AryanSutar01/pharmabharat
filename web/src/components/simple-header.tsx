import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/ui";
import { getSession } from "@/lib/session";

/** Minimal top bar for pages outside the main app shell (onboarding, invites). */
export async function SimpleHeader() {
  const session = await getSession();
  const t = await getTranslations("nav");
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          {session?.user.platformRole === "admin" ? (
            <Link href="/admin" className="text-sm font-medium text-brand-700 hover:underline">
              {t("admin")}
            </Link>
          ) : null}
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
