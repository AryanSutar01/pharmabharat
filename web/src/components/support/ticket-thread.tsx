import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, cn } from "@/components/ui";
import type { TicketDoc } from "@/lib/models/ticket";
import { PRIORITY_TONE, STATUS_TONE, type TicketPriority, type TicketStatus } from "@/lib/support/constants";

/** Ticket header + conversation, shared by the business view and the support desk. */
export async function TicketThread({ ticket, viewer }: { ticket: TicketDoc; viewer: "business" | "support" }) {
  const t = await getTranslations("support");
  const format = await getFormatter();
  const status = ticket.status as TicketStatus;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[status]}>{t(`statusLabel.${status}`)}</Badge>
          <Badge tone={PRIORITY_TONE[(ticket.priority ?? "normal") as TicketPriority]}>{t(`priorityLabel.${ticket.priority ?? "normal"}`)}</Badge>
          <Badge>{t(`categoryLabel.${ticket.category}`)}</Badge>
          {ticket.orderNo ? <Badge tone="info">{ticket.orderNo}</Badge> : null}
        </div>
        <p className="mt-2 text-xs text-muted">
          {ticket.number} · {ticket.businessName} · {ticket.createdByName} ·{" "}
          {format.dateTime(new Date(ticket.createdAt), { dateStyle: "medium", timeStyle: "short" })}
        </p>
        <p className="mt-1 text-xs text-muted">
          {ticket.assigneeName ? t("assignedTo", { name: ticket.assigneeName }) : t("unassigned")}
        </p>
        {ticket.kind === "callback" && ticket.callback?.phone ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            📞{" "}
            {t("callbackDetails", {
              phone: ticket.callback.phone,
              slot: t(`slotLabel.${ticket.callback.slot ?? "morning"}`),
              language: { en: "English", hi: "हिन्दी", mr: "मराठी" }[ticket.callback.language ?? "en"] ?? "English",
            })}
          </p>
        ) : null}
      </Card>

      <ol className="space-y-3">
        {ticket.replies.map((r, i) => {
          const mine = viewer === "support" ? r.fromSupport : !r.fromSupport;
          return (
            <li key={i} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-4 py-3 text-sm sm:max-w-[75%]",
                  r.fromSupport ? "border border-amber-200 bg-amber-50" : "border border-line bg-white",
                )}
              >
                <p className="mb-1 text-xs font-semibold text-muted">
                  {r.fromSupport ? `${t("supportTeam")} · ${r.authorName}` : r.authorName} ·{" "}
                  <span className="font-normal">{format.dateTime(new Date(r.at ?? ticket.createdAt), { dateStyle: "medium", timeStyle: "short" })}</span>
                </p>
                <p className="whitespace-pre-wrap break-words">{r.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
