import { getTranslations } from "next-intl/server";
import { ChatShell } from "@/app/app/chat/chat-shell";
import { listSupportConversations } from "@/lib/chat/service";
import { requirePlatformRole } from "@/lib/session";

export default async function DeskChatLayout({ children }: LayoutProps<"/support-desk/chat">) {
  await requirePlatformRole("support", "admin");
  const t = await getTranslations("desk");
  const conversations = await listSupportConversations();
  return (
    <ChatShell conversations={conversations} basePath="/support-desk/chat" emptyText={t("noChats")}>
      {children}
    </ChatShell>
  );
}
