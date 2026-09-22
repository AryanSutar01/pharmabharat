import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TicketForm } from "@/components/support/ticket-form";
import { Card, PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/session";

export const metadata = { title: "New ticket" };

export default async function NewTicketPage({ searchParams }: PageProps<"/app/support/new">) {
  const { business } = await requireBusiness();
  const kind = (await searchParams).kind === "callback" ? "callback" : "ticket";
  const t = await getTranslations("support");
  return (
    <>
      <Link href="/app/support" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← {t("title")}
      </Link>
      <PageHeader title={kind === "callback" ? t("callbackTitle") : t("ticketTitle")} />
      <Card className="max-w-2xl p-4 sm:p-6">
        <TicketForm kind={kind} defaultPhone={business.phone ?? ""} />
      </Card>
    </>
  );
}
