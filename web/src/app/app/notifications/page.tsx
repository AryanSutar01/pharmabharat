import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button, Card, PageHeader, buttonClass, cn } from "@/components/ui";
import type { NotificationDoc } from "@/lib/models/notification";
import { listNotifications } from "@/lib/notifications";
import { requireBusiness } from "@/lib/session";
import { markNotificationsRead } from "../alerts/actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { business, session } = await requireBusiness();
  const t = await getTranslations();
  const format = await getFormatter();
  const items = await listNotifications(session.user.id, business._id);
  const inr = (v: unknown) => format.number(Number(v) || 0, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const hasUnread = items.some((n) => !n.readAt);

  // Stored params are raw values; format money and translate statuses for the viewer's language.
  function text(n: NotificationDoc) {
    const p = { ...(n.params as Record<string, string | number>) };
    for (const k of ["from", "to", "total"]) if (k in p) p[k] = inr(p[k]);
    if (typeof p.status === "string") p.status = t(`orders.statusLabel.${p.status}`);
    return t(`notifications.kind.${n.kind}`, p);
  }

  return (
    <>
      <PageHeader
        title={t("notifications.title")}
        action={
          <div className="flex gap-2">
            <Link href="/app/alerts" className={buttonClass("secondary")}>
              {t("notifications.manageAlerts")}
            </Link>
            {hasUnread ? (
              <form action={markNotificationsRead}>
                <Button type="submit" variant="secondary">
                  {t("notifications.markAllRead")}
                </Button>
              </form>
            ) : null}
          </div>
        }
      />
      <Card>
        {items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">{t("notifications.empty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const body = (
                <div className="flex gap-3">
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-600")}
                    aria-label={n.readAt ? undefined : t("notifications.new")}
                  />
                  <div className="min-w-0">
                    <p className={cn("text-sm", n.readAt ? "text-muted" : "font-medium text-ink")}>{text(n)}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {format.relativeTime(new Date(n.createdAt), new Date())}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={String(n._id)}>
                  {n.link ? (
                    <Link href={n.link} className="block px-4 py-3 hover:bg-canvas sm:px-5">
                      {body}
                    </Link>
                  ) : (
                    <div className="px-4 py-3 sm:px-5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
