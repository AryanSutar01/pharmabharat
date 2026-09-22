"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export function DeskTabs({ labels }: { labels: { tickets: string; chat: string } }) {
  const pathname = usePathname();
  const chat = pathname.startsWith("/support-desk/chat");
  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={cn(
        "border-b-2 px-2 py-2 text-sm font-medium",
        active ? "border-amber-500 text-ink" : "border-transparent text-muted hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav className="mx-auto flex max-w-6xl gap-2 px-4 sm:px-6">
      {tab("/support-desk", labels.tickets, !chat)}
      {tab("/support-desk/chat", labels.chat, chat)}
    </nav>
  );
}
