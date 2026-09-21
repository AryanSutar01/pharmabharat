import { getTranslations } from "next-intl/server";
import { SimpleHeader } from "@/components/simple-header";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { CreateBusinessForm } from "../create-business-form";

export const metadata = { title: "Add business" };

/** Lets a user who already belongs to a business register another one. */
export default async function NewBusinessPage() {
  await requireUser();
  const t = await getTranslations("onboarding");
  return (
    <>
      <SimpleHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader title={t("title")} description={t("createSubtitle")} />
        <Card className="p-4 sm:p-6">
          <CreateBusinessForm />
        </Card>
      </main>
    </>
  );
}
