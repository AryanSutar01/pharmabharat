import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { communityTitle, getConversation, getMessages, markRead, otherReadAt, supportReadAtIso } from "@/lib/chat/service";
import { connectDB } from "@/lib/db/mongo";
import { stateName } from "@/lib/india";
import { Business } from "@/lib/models/business";
import { requireBusiness } from "@/lib/session";
import {
  fetchNewMessages,
  fetchOlderMessages,
  getChatUploadSignature,
  markConversationRead,
  reportMessage,
  sendChatMessage,
} from "../actions";
import { ChatThread } from "./chat-thread";

export const metadata = { title: "Chat" };

export default async function ConversationPage({ params }: PageProps<"/app/chat/[id]">) {
  const { business } = await requireBusiness({ permission: "chat.use" });
  const { id } = await params;
  const conv = await getConversation(id, business);
  if (!conv) notFound();
  const t = await getTranslations("chat");

  let title: string;
  let subtitle: string;
  if (conv.type === "community") {
    title = conv.slug === "india" ? t("allIndia") : communityTitle(conv.slug!);
    subtitle = t("communityRules");
  } else if (conv.type === "support") {
    title = t("supportTitle");
    subtitle = t("supportHint");
  } else {
    await connectDB();
    const otherId = conv.participants.find((p) => String(p) !== String(business._id));
    const other = await Business.findById(otherId, { legalName: 1, tradeName: 1, type: 1, address: 1 }).lean();
    title = other ? other.tradeName || other.legalName : "—";
    subtitle = other?.address ? `${other.address.city}, ${stateName(other.address.stateCode)}` : "";
  }

  const [{ messages, hasMore }] = await Promise.all([getMessages(conv._id), markRead(conv, business)]);

  return (
    <ChatThread
      key={id}
      conversationId={id}
      viewer={{ kind: "business", businessId: String(business._id) }}
      backHref="/app/chat"
      actions={{
        send: sendChatMessage,
        fetchNew: fetchNewMessages,
        fetchOlder: fetchOlderMessages,
        markRead: markConversationRead,
        uploadSignature: getChatUploadSignature,
        report: conv.type === "support" ? undefined : reportMessage,
      }}
      isCommunity={conv.type === "community"}
      title={title}
      subtitle={subtitle}
      initialMessages={messages}
      initialHasMore={hasMore}
      initialOtherReadAt={
        conv.type === "direct" ? otherReadAt(conv, business) : conv.type === "support" ? supportReadAtIso(conv) : null
      }
      canUploadImages={cloudinaryConfigured()}
    />
  );
}
