import { getTranslations } from "next-intl/server";
import { startDirectChat } from "@/app/app/chat/actions";
import { buttonClass, cn } from "@/components/ui";

/** Opens (or creates) the direct chat with another business. */
export async function ChatButton({
  businessId,
  className,
  label,
  iconOnly,
}: {
  businessId: string;
  className?: string;
  label?: string;
  /** Compact square button; the label becomes the accessible name / tooltip. */
  iconOnly?: boolean;
}) {
  const t = await getTranslations("chat");
  const text = label ?? t("chatWithSeller");
  return (
    <form action={startDirectChat.bind(null, businessId)}>
      <button
        type="submit"
        className={cn(buttonClass("secondary", "h-9 px-3"), className)}
        aria-label={iconOnly ? text : undefined}
        title={iconOnly ? text : undefined}
      >
        <span aria-hidden>💬</span>
        {iconOnly ? null : text}
      </button>
    </form>
  );
}
