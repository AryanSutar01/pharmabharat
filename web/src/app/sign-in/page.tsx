import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/ui";
import { getSession } from "@/lib/session";
import { GoogleButton } from "./google-button";

export const metadata = { title: "Sign in" };

/** Only allow same-site relative redirects after login. */
function safeNext(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.startsWith("/") && !s.startsWith("//") ? s : "/app";
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  const t = await getTranslations();
  const points = [t("landing.featureVerified"), t("landing.featureMargin"), t("landing.featureGst")];

  return (
    <div className="grid min-h-full flex-1 lg:grid-cols-2">
      {/* Brand panel (desktop only) */}
      <aside className="relative hidden overflow-hidden bg-brand-800 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_25rem_at_100%_0%,rgba(22,163,127,0.45),transparent_60%)]"
        />
        <Link href="/" className="relative inline-flex items-center gap-2 font-semibold">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
            <rect width="32" height="32" rx="8" fill="#fff" />
            <path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z" fill="#0d8467" />
          </svg>
          PharmaBharat
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">{t("landing.headline")}</h2>
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-sm leading-relaxed text-white/85">
                <svg viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0 text-brand-200" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 10.5l3.5 3.5L15 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">{t("landing.footer", { year: new Date().getFullYear() })}</p>
      </aside>

      {/* Sign-in */}
      <div className="flex flex-col items-center justify-center bg-white px-4 py-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight lg:mt-0">{t("signIn.title")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t("signIn.subtitle")}</p>
          <div className="mt-8">
            <GoogleButton next={next} />
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted">{t("signIn.terms")}</p>
          <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
            <LanguageSwitcher />
            <Link href="/help" className="text-sm text-muted hover:text-ink">
              {t("help.title")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
