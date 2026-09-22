import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";

export default async function DeskChatIndex() {
  const t = await getTranslations("desk");
  return <Card className="grid h-full min-h-60 place-items-center p-6 text-sm text-muted">{t("selectChat")}</Card>;
}
