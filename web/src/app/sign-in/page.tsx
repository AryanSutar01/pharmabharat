import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Card, Logo } from "@/components/ui";
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
  const t = await getTranslations("signIn");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <h1 className="mt-6 text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        <div className="mt-6">
          <GoogleButton next={next} />
        </div>
        <p className="mt-6 text-xs text-muted">{t("terms")}</p>
      </Card>
      <LanguageSwitcher className="mt-6" />
    </div>
  );
}
