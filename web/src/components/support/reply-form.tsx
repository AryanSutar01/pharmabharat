"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { SupportFormState } from "@/app/app/support/actions";
import { Button, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";

export function ReplyForm({
  action: serverAction,
  hint,
}: {
  action: (state: SupportFormState, formData: FormData) => Promise<SupportFormState>;
  hint?: string;
}) {
  const t = useTranslations("support");
  const err = useErrorText();
  const [state, action, pending] = useActionState<SupportFormState, FormData>(serverAction, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-2">
      <Textarea name="text" rows={4} maxLength={5000} placeholder={t("replyPlaceholder")} aria-label={t("reply")} required />
      {state.errors?.text ? <p className="text-xs text-red-600">{err(state.errors.text)}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{hint}</span>
        <Button type="submit" disabled={pending}>
          {pending ? "…" : t("send")}
        </Button>
      </div>
    </form>
  );
}
