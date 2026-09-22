import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { listConversations } from "@/lib/chat/service";
import { requireBusiness } from "@/lib/session";
import { ChatShell } from "./chat-shell";

export const metadata = { title: "Chat" };

export default async function ChatLayout({ children }: LayoutProps<"/app/chat">) {
  const { business } = await requireBusiness({ permission: "chat.use" });
  const t = await getTranslations("chat");
  const conversations = await listConversations(business);

  return (
    <>
      <div className="hidden lg:block">
        <PageHeader title={t("title")} description={t("subtitle")} />
      </div>
      <ChatShell conversations={conversations}>{children}</ChatShell>
    </>
  );
}
