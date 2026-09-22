"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import type { OrderAction } from "@/lib/orders/status";
import { orderAction, type OrderActionResult } from "../actions";

const VARIANT: Record<OrderAction, "primary" | "secondary" | "danger"> = {
  accept: "primary",
  pack: "secondary",
  dispatch: "primary",
  deliver: "primary",
  markPaid: "secondary",
  reject: "danger",
  cancel: "danger",
};

export function OrderActions({ orderId, actions }: { orderId: string; actions: OrderAction[] }) {
  const t = useTranslations("orders");
  const err = useErrorText();
  const [state, action, pending] = useActionState<OrderActionResult, FormData>(orderAction.bind(null, orderId), {});
  const [note, setNote] = useState("");
  const needsNote = actions.includes("reject");

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "cancel" && !confirm(t("confirmCancel"))) e.preventDefault();
      }}
    >
      {state.ok ? <Alert tone="success" title={t("updated")} /> : null}
      {state.error ? <Alert tone="danger" title={err(state.error)} /> : null}
      <Field label={needsNote ? t("noteRequired") : t("note")}>
        <Textarea name="note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex flex-col gap-2">
        {actions.map((a) => (
          <Button
            key={a}
            type="submit"
            name="action"
            value={a}
            variant={VARIANT[a]}
            disabled={pending || (a === "reject" && !note.trim())}
          >
            {t(`action.${a}`)}
          </Button>
        ))}
      </div>
    </form>
  );
}
