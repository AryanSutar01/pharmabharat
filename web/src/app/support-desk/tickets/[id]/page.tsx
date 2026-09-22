import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { getTranslations } from "next-intl/server";
import { ReplyForm } from "@/components/support/reply-form";
import { TicketThread } from "@/components/support/ticket-thread";
import { Button, Card, CardHeader, Field, PageHeader, Select } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Ticket } from "@/lib/models/ticket";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/support/constants";
import { requirePlatformRole } from "@/lib/session";
import { deskReply, deskUpdate } from "../../actions";

export const metadata = { title: "Ticket" };

export default async function DeskTicketPage({ params }: PageProps<"/support-desk/tickets/[id]">) {
  const session = await requirePlatformRole("support", "admin");
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await connectDB();
  const ticket = await Ticket.findById(id).lean();
  if (!ticket) notFound();
  const t = await getTranslations();
  const mine = ticket.assigneeUserId === session.user.id;

  return (
    <>
      <Link href="/support-desk" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← {t("desk.tickets")}
      </Link>
      <PageHeader title={ticket.subject} description={`${ticket.number} · ${ticket.businessName}`} />
      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-5">
          <TicketThread ticket={ticket} viewer="support" />
          {ticket.status !== "closed" ? (
            <Card className="p-4 sm:p-5">
              <ReplyForm action={deskReply.bind(null, id)} hint={t("desk.internalHint")} />
            </Card>
          ) : null}
        </div>

        <Card className="h-fit lg:sticky lg:top-32">
          <CardHeader title={t("desk.update")} />
          <form action={deskUpdate.bind(null, id)} className="space-y-4 p-4 sm:p-5">
            <Field label={t("orders.status")}>
              <Select name="status" defaultValue={ticket.status ?? "open"}>
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`support.statusLabel.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("support.priority")}>
              <Select name="priority" defaultValue={ticket.priority ?? "normal"}>
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`support.priorityLabel.${p}`)}
                  </option>
                ))}
              </Select>
            </Field>
            {!mine ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="assignToMe" value="1" className="size-4 accent-amber-500" />
                {t("desk.assignToMe")}
              </label>
            ) : null}
            <Button type="submit" className="w-full">
              {t("desk.update")}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
