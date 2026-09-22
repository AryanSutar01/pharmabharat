import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Ticket } from "@/lib/models/ticket";
import { can } from "@/lib/permissions";
import { STATUS_TONE, type TicketStatus } from "@/lib/support/constants";
import { requireBusiness } from "@/lib/session";
import { openSupportChat } from "./actions";

export const metadata = { title: "Help & support" };

export default async function SupportPage() {
  const { business, role } = await requireBusiness();
  const t = await getTranslations();
  const format = await getFormatter();
  await connectDB();
  const tickets = await Ticket.find({ businessId: business._id }).sort({ lastActivityAt: -1 }).limit(100).lean();

  return (
    <>
      <PageHeader title={t("support.title")} description={t("support.subtitle")} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/app/support/new?kind=ticket" className={buttonClass("primary", "h-auto py-3")}>
          🎫 {t("support.newTicket")}
        </Link>
        <Link href="/app/support/new?kind=callback" className={buttonClass("secondary", "h-auto py-3")}>
          📞 {t("support.callback")}
        </Link>
        {can(role, "chat.use") ? (
          <form action={openSupportChat} className="contents">
            <button type="submit" className={buttonClass("secondary", "h-auto py-3")}>
              💬 {t("support.liveChat")}
            </button>
          </form>
        ) : null}
        <Link href="/help" className={buttonClass("secondary", "h-auto py-3")}>
          ❓ {t("support.faq")}
        </Link>
      </div>

      <Card>
        <CardHeader title={t("support.myTickets")} />
        {tickets.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">{t("support.noTickets")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {tickets.map((tk) => (
              <li key={String(tk._id)}>
                <Link href={`/app/support/${tk._id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-canvas sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tk.subject}</p>
                    <p className="text-xs text-muted">
                      {tk.number} · {t(`support.kindLabel.${tk.kind ?? "ticket"}`)} · {t(`support.categoryLabel.${tk.category}`)} ·{" "}
                      {format.relativeTime(new Date(tk.lastActivityAt ?? tk.createdAt), new Date())}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[tk.status as TicketStatus]}>{t(`support.statusLabel.${tk.status}`)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
