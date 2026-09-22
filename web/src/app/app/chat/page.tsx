import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";

/** Right pane placeholder on large screens; on phones the list (from the layout) is shown instead. */
export default async function ChatIndex() {
  const t = await getTranslations("chat");
  return (
    <Card className="grid h-full min-h-60 place-items-center p-6 text-sm text-muted">
      <p>{t("select")}</p>
    </Card>
  );
}
