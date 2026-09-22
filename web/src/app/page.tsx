import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NavIcon } from "@/components/app-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo, buttonClass } from "@/components/ui";
import { getSession } from "@/lib/session";
import { BUSINESS_TYPES } from "@/lib/permissions";

const TYPE_ICON = { retailer: "cart", wholesaler: "inventory", company: "business" } as const;

export default async function Home() {
  const t = await getTranslations();
  const session = await getSession();
  const cta = session ? "/app" : "/sign-in";

  const stats = [
    { value: "2.4 lakh+", label: t("landing.statMedicines") },
    { value: "3", label: t("landing.statLanguages") },
    { value: "CGST · SGST · IGST", label: t("landing.statGst") },
    { value: "100%", label: t("landing.statVerified") },
  ];
  const steps = [
    { title: t("landing.step1Title"), body: t("landing.step1") },
    { title: t("landing.step2Title"), body: t("landing.step2") },
    { title: t("landing.step3Title"), body: t("landing.step3") },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/help" className="hidden text-sm text-muted hover:text-ink sm:inline">
              {t("help.title")}
            </Link>
            <LanguageSwitcher />
            <Link href={cta} className={buttonClass("primary", "h-9 px-4")}>
              {t("landing.signIn")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_-10%,var(--color-brand-100),transparent_60%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-20 lg:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
                <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
                {t("landing.tagline")}
              </p>
              <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-[1.15] tracking-tight text-ink sm:text-5xl">
                {t("landing.headline")}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{t("landing.subhead")}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={cta} className={buttonClass("primary", "h-12 px-6 text-base")}>
                  {t("landing.cta")} →
                </Link>
                <a href="#how" className={buttonClass("secondary", "h-12 px-6 text-base")}>
                  {t("landing.ctaSecondary")}
                </a>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                {[t("landing.trust1"), t("landing.trust2"), t("landing.trust3")].map((x) => (
                  <li key={x} className="flex items-center gap-1.5">
                    <svg viewBox="0 0 20 20" className="size-4 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                      <path d="M5 10.5l3.5 3.5L15 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {x}
                  </li>
                ))}
              </ul>
            </div>

            <ProductPreview t={t} />
          </div>
        </section>

        {/* Numbers */}
        <section className="border-y border-line bg-canvas">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-line sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-canvas px-4 py-6 text-center sm:px-6">
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-lg font-semibold tracking-tight text-ink sm:text-2xl">{s.value}</dd>
                <dd className="mt-1 text-xs text-muted sm:text-sm">{s.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("landing.howTitle")}</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-line bg-white p-6">
                <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Who it's for */}
        <section className="bg-canvas">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("landing.whoTitle")}</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {BUSINESS_TYPES.map((type) => (
                <div key={type} className="rounded-2xl border border-line bg-white p-6">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <NavIcon name={TYPE_ICON[type]} className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{t(`businessType.${type}`)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(`businessTypeHelp.${type}`)}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <Link href={cta} className={buttonClass("primary", "h-12 px-8 text-base")}>
                {t("landing.cta")} →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-muted sm:px-6">
          <span>{t("landing.footer", { year: new Date().getFullYear() })}</span>
          <Link href="/help" className="hover:text-ink">
            {t("help.title")}
          </Link>
        </div>
      </footer>
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;

/** Illustrative UI fragment (not live data): one medicine, three distributor offers. */
function ProductPreview({ t }: { t: T }) {
  const offers = [
    { name: "Sahyadri Pharma", city: "Pune", price: "₹24.02", margin: 28.5, best: true },
    { name: "Sabarmati Medico", city: "Ahmedabad", price: "₹25.37", margin: 24.5 },
    { name: "Konkan Distributors", city: "Thane", price: "₹26.88", margin: 20.0 },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0" aria-hidden>
      <div className="absolute -inset-3 -z-10 rounded-3xl bg-gradient-to-br from-brand-100 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_50px_-20px_rgba(13,85,69,0.35)]">
        <div className="border-b border-line px-5 py-4">
          <p className="font-semibold">{t("landing.previewTitle")}</p>
          <p className="text-xs text-muted">{t("landing.previewSub")}</p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-muted">{t("landing.previewMrp")}</span>
            <span className="text-muted">{t("landing.previewSellers")}</span>
          </div>
        </div>
        <ul className="divide-y divide-line">
          {offers.map((o) => (
            <li key={o.name} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{o.name}</p>
                <p className="text-xs text-muted">{o.city}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{o.price}</p>
                <span
                  className={
                    o.best
                      ? "inline-block rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-medium text-white"
                      : "inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800"
                  }
                >
                  {o.margin}% {o.best ? `· ${t("landing.previewBest")}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 bg-canvas px-5 py-3">
          <span className="text-xs text-muted">{t("cart.sameState")}</span>
          <span className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">{t("cart.addToCart")}</span>
        </div>
      </div>
    </div>
  );
}
