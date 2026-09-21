import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { requireBusiness } from "@/lib/session";

export default async function Page() {
  await requireBusiness();
  const t = await getTranslations("nav");
  return <ComingSoon title={t("chat")} />;
}
