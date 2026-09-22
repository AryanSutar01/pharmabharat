import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { TicketForm } from "@/components/support/ticket-form";
import { Card, CardHeader, Logo, buttonClass } from "@/components/ui";
import { env } from "@/lib/env";
import { getBusinessContext, getSession } from "@/lib/session";

export const metadata = { title: "Help centre" };

const QUESTIONS = ["verify", "rejected", "staff", "margin", "split", "gst", "payment", "cancel", "alerts", "expiry"] as const;

/** Public FAQ. Signed-in businesses still in verification can request a call back here. */
export default async function HelpPage() {
  const t = await getTranslations();
  const session = await getSession();
  const ctx = session ? await getBusinessContext().catch(() => null) : null;
  const approved = ctx?.business?.kyc?.status === "approved";
  const supportEmail = env().SUPPORT_EMAIL;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={session ? "/app" : "/"}>
            <Logo />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("help.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("help.subtitle")}</p>
        </div>

        <Card className="divide-y divide-line">
          {QUESTIONS.map((q) => (
            <details key={q} className="group px-4 py-3 sm:px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {t(`help.q.${q}.q`)}
                <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(`help.q.${q}.a`)}</p>
            </details>
          ))}
        </Card>

        <Card>
          <CardHeader title={t("help.stillNeedHelp")} />
          <div className="space-y-4 p-4 sm:p-5">
            {approved ? (
              <>
                <p className="text-sm text-muted">{t("help.contactSignedIn")}</p>
                <Link href="/app/support" className={buttonClass("primary")}>
                  {t("help.goToSupport")}
                </Link>
              </>
            ) : ctx?.business ? (
              // Business still in verification: no app access yet, so offer a call back here.
              <>
                <p className="font-medium">{t("support.callbackTitle")}</p>
                <TicketForm kind="callback" defaultPhone={ctx.business.phone ?? ""} />
              </>
            ) : (
              <p className="text-sm text-muted">
                {t("help.contactSignedOut")}{" "}
                <Link href="/sign-in?next=/help" className="text-brand-700 underline">
                  {t("landing.signIn")}
                </Link>
              </p>
            )}
            {supportEmail ? <p className="text-sm text-muted">{t("help.email", { email: supportEmail })}</p> : null}
          </div>
        </Card>
      </main>
    </div>
  );
}
