import { getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/ui";

export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations("common");
  return (
    <>
      <PageHeader title={title} />
      <Card className="grid place-items-center px-4 py-16 text-center">
        <p className="text-sm text-muted">{t("comingSoon")}</p>
      </Card>
    </>
  );
}
