import { getTranslations } from "next-intl/server";
import { startDirectChat } from "@/app/app/chat/actions";
import { buttonClass, cn } from "@/components/ui";

/** Opens (or creates) the direct chat with another business. */
export async function ChatButton({ businessId, className, label }: { businessId: string; className?: string; label?: string }) {
  const t = await getTranslations("chat");
  return (
    <form action={startDirectChat.bind(null, businessId)}>
      <button type="submit" className={cn(buttonClass("secondary", "h-9 px-3"), className)}>
        💬 {label ?? t("chatWithSeller")}
      </button>
    </form>
  );
}
