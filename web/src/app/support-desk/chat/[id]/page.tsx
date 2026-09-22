import { notFound } from "next/navigation";
import { ChatThread } from "@/app/app/chat/[id]/chat-thread";
import { getMessages, getSupportConversation, markSupportRead, otherReadAt } from "@/lib/chat/service";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { connectDB } from "@/lib/db/mongo";
import { stateName } from "@/lib/india";
import { Business } from "@/lib/models/business";
import { requirePlatformRole } from "@/lib/session";
import { agentFetchNew, agentFetchOlder, agentMarkRead, agentSend, agentUploadSignature } from "../../actions";

export default async function DeskChatPage({ params }: PageProps<"/support-desk/chat/[id]">) {
  await requirePlatformRole("support", "admin");
  const { id } = await params;
  const conv = await getSupportConversation(id);
  if (!conv) notFound();
  await connectDB();
  const business = await Business.findById(conv.participants[0], { legalName: 1, tradeName: 1, address: 1, type: 1 }).lean();
  const [{ messages, hasMore }] = await Promise.all([getMessages(conv._id), markSupportRead(conv)]);

  return (
    <ChatThread
      key={id}
      conversationId={id}
      viewer={{ kind: "support" }}
      backHref="/support-desk/chat"
      actions={{
        send: agentSend,
        fetchNew: agentFetchNew,
        fetchOlder: agentFetchOlder,
        markRead: agentMarkRead,
        uploadSignature: agentUploadSignature,
      }}
      isCommunity={false}
      title={business ? business.tradeName || business.legalName : "—"}
      subtitle={business?.address ? `${business.address.city}, ${stateName(business.address.stateCode)}` : ""}
      initialMessages={messages}
      initialHasMore={hasMore}
      initialOtherReadAt={business ? otherReadAt(conv, business) : null}
      canUploadImages={cloudinaryConfigured()}
    />
  );
}
