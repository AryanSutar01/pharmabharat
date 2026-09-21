import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo, buttonClass } from "@/components/ui";
import { getSession } from "@/lib/session";
import { BUSINESS_TYPES } from "@/lib/permissions";

export default async function Home() {
  const t = await getTranslations();
  const session = await getSession();
  const cta = session ? "/app" : "/sign-in";

  const features = [
    { title: t("landing.featureVerifiedTitle"), body: t("landing.featureVerified"), icon: "M5 10.5l3.5 3.5L15 7" },
    { title: t("landing.featureMarginTitle"), body: t("landing.featureMargin"), icon: "M4 15l4-5 3 3 5-7" },
    { title: t("landing.featureGstTitle"), body: t("landing.featureGst"), icon: "M6 3h8v14l-4-2-4 2zM8 7h4M8 10h4" },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher />
          <Link href={cta} className={buttonClass("secondary", "h-9 px-3")}>
            {t("landing.signIn")}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pt-16 lg:pt-24">
          <p className="text-sm font-medium text-brand-700">{t("landing.tagline")}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            {t("landing.headline")}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{t("landing.subhead")}</p>
          <div className="mt-8">
            <Link href={cta} className={buttonClass("primary", "h-12 px-6 text-base")}>
              {t("landing.cta")}
            </Link>
          </div>
        </section>

        <section className="border-y border-line bg-canvas">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-line bg-white p-5">
                <svg
                  viewBox="0 0 20 20"
                  className="size-8 rounded-lg bg-brand-50 p-1.5 text-brand-700"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={f.icon} />
                </svg>
                <h2 className="mt-3 font-semibold">{f.title}</h2>
                <p className="mt-1 text-sm text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("landing.whoTitle")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {BUSINESS_TYPES.map((type) => (
              <div key={type} className="rounded-xl border border-line p-5">
                <h3 className="font-semibold">{t(`businessType.${type}`)}</h3>
                <p className="mt-1 text-sm text-muted">{t(`businessTypeHelp.${type}`)}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        {t("landing.footer", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
