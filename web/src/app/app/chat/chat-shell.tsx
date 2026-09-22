"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Card, cn } from "@/components/ui";
import type { ConversationSummary } from "@/lib/chat/service";

/**
 * Two panes on large screens (list + thread). On phones only one pane shows:
 * the list at /app/chat, the thread at /app/chat/[id].
 */
export function ChatShell({ conversations, children }: { conversations: ConversationSummary[]; children: ReactNode }) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const params = useParams<{ id?: string }>();
  const activeId = params.id;
  const community = conversations.filter((c) => c.type === "community");
  const direct = conversations.filter((c) => c.type === "direct");

  const item = (c: ConversationSummary) => (
    <li key={c.id}>
      <Link
        href={`/app/chat/${c.id}`}
        className={cn(
          "flex items-start gap-3 px-4 py-3 hover:bg-canvas",
          activeId === c.id && "bg-brand-50 hover:bg-brand-50",
        )}
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
            c.type === "community" ? "bg-sky-100 text-sky-800" : "bg-brand-100 text-brand-800",
          )}
          aria-hidden
        >
          {c.type === "community" ? "#" : c.title.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>
              {c.slug === "india" ? t("allIndia") : c.title}
            </span>
            {c.lastMessageAt ? (
              <span className="shrink-0 text-[11px] text-muted">{format.relativeTime(new Date(c.lastMessageAt), new Date())}</span>
            ) : null}
          </span>
          <span className="flex items-center gap-2">
            <span className="truncate text-xs text-muted">
              {c.lastMessagePreview || (c.type === "community" ? t("communityHint") : c.subtitle)}
            </span>
            {c.unread ? <span className="size-2 shrink-0 rounded-full bg-brand-600" aria-label="unread" /> : null}
          </span>
        </span>
      </Link>
    </li>
  );

  return (
    <div className="grid gap-5 lg:h-[calc(100dvh-8rem)] lg:grid-cols-[20rem_1fr]">
      <Card className={cn("overflow-hidden lg:flex lg:flex-col", activeId && "hidden lg:flex")}>
        <div className="overflow-y-auto">
          <p className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted">{t("community")}</p>
          <ul>{community.map(item)}</ul>
          <p className="border-t border-line px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted">{t("direct")}</p>
          {direct.length ? <ul>{direct.map(item)}</ul> : <p className="px-4 pb-4 text-sm text-muted">{t("noDirect")}</p>}
        </div>
      </Card>
      <div className={cn("min-h-0", !activeId && "hidden lg:block")}>{children}</div>
    </div>
  );
}
