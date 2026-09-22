import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, PageHeader, cn } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Ticket } from "@/lib/models/ticket";
import {
  ACTIVE_STATUSES,
  PRIORITY_TONE,
  STATUS_TONE,
  TICKET_PRIORITIES,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support/constants";
import { requirePlatformRole } from "@/lib/session";

export const metadata = { title: "Support desk" };

export default async function DeskQueue({ searchParams }: PageProps<"/support-desk">) {
  await requirePlatformRole("support", "admin");
  const t = await getTranslations();
  const format = await getFormatter();
  const filter = (await searchParams).filter === "all" ? "all" : "active";

  await connectDB();
  const tickets = await Ticket.find(filter === "active" ? { status: { $in: ACTIVE_STATUSES } } : {})
    .sort({ lastActivityAt: -1 })
    .limit(200)
    .select({ replies: 0 })
    .lean();
  // Most urgent first, then most recently active.
  const rank = (p: string) => TICKET_PRIORITIES.length - TICKET_PRIORITIES.indexOf(p as TicketPriority);
  tickets.sort((a, b) => rank(b.priority ?? "normal") - rank(a.priority ?? "normal"));

  return (
    <>
      <PageHeader
        title={t("desk.tickets")}
        action={
          <div className="flex gap-2 text-sm">
            {(["active", "all"] as const).map((f) => (
              <Link
                key={f}
                href={`/support-desk?filter=${f}`}
                className={cn(
                  "rounded-full border px-3 py-1",
                  f === filter ? "border-amber-500 bg-amber-50 text-amber-900" : "border-line bg-white text-muted",
                )}
              >
                {f === "active" ? t("desk.filterActive") : t("desk.filterAll")}
              </Link>
            ))}
          </div>
        }
      />
      <Card>
        {tickets.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">{t("desk.empty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {tickets.map((tk) => (
              <li key={String(tk._id)}>
                <Link href={`/support-desk/tickets/${tk._id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-canvas sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {tk.kind === "callback" ? "📞 " : ""}
                      {tk.subject}
                    </p>
                    <p className="text-xs text-muted">
                      {tk.number} · {tk.businessName} · {t(`support.categoryLabel.${tk.category}`)} ·{" "}
                      {format.relativeTime(new Date(tk.lastActivityAt ?? tk.createdAt), new Date())}
                      {tk.assigneeName ? ` · ${tk.assigneeName}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Badge tone={PRIORITY_TONE[(tk.priority ?? "normal") as TicketPriority]}>{t(`support.priorityLabel.${tk.priority ?? "normal"}`)}</Badge>
                    <Badge tone={STATUS_TONE[tk.status as TicketStatus]}>{t(`support.statusLabel.${tk.status}`)}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
