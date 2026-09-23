"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { markRefillContacted } from "./actions";

/** "Called" tick for the counter's list. */
export function ContactedButton({
  customerId,
  productId,
  dueOn,
}: {
  customerId: string;
  productId: string;
  dueOn: string;
}) {
  const t = useTranslations("shop");
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await markRefillContacted(customerId, productId, dueOn)))}
      className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-60"
    >
      {pending ? t("marking") : t("markCalled")}
    </button>
  );
}
