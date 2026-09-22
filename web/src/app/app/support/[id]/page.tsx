import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReplyForm } from "@/components/support/reply-form";
import { TicketThread } from "@/components/support/ticket-thread";
import { Button, Card, PageHeader } from "@/components/ui";
import { getTicketForBusiness } from "@/lib/support/service";
import { requireBusiness } from "@/lib/session";
import { replyToTicket, setMyTicketStatus } from "../actions";

export const metadata = { title: "Support ticket" };

export default async function TicketPage({ params }: PageProps<"/app/support/[id]">) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const ticket = await getTicketForBusiness(id, business);
  if (!ticket) notFound();
  const t = await getTranslations("support");
  const closed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <>
      <Link href="/app/support" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← {t("title")}
      </Link>
      <PageHeader
        title={ticket.subject}
        action={
          <form action={setMyTicketStatus.bind(null, id, closed ? "open" : "closed")}>
            <Button type="submit" variant="secondary">
              {closed ? t("reopen") : t("close")}
            </Button>
          </form>
        }
      />
      <div className="max-w-3xl space-y-5">
        <TicketThread ticket={ticket} viewer="business" />
        {ticket.status !== "closed" ? (
          <Card className="p-4 sm:p-5">
            <ReplyForm action={replyToTicket.bind(null, id)} />
          </Card>
        ) : null}
      </div>
    </>
  );
}
