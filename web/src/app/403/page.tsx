import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui";

export default async function Denied() {
  const t = await getTranslations("denied");
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-5xl font-semibold text-brand-700">403</p>
      <h1 className="mt-4 text-xl font-semibold">{t("title")}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">{t("body")}</p>
      <Link href="/app" className={buttonClass("primary", "mt-6")}>
        {t("home")}
      </Link>
    </div>
  );
}
