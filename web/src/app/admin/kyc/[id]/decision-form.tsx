"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import type { KycStatus } from "@/lib/models/business";
import { decideKyc, type DecisionState } from "../actions";

export function DecisionForm({ businessId, status }: { businessId: string; status: KycStatus }) {
  const t = useTranslations("admin");
  const err = useErrorText();
  const [state, action, pending] = useActionState<DecisionState, FormData>(decideKyc.bind(null, businessId), {});

  const buttons: { decision: string; label: string; variant: "primary" | "secondary" | "danger" }[] =
    status === "pending"
      ? [
          { decision: "approve", label: t("approve"), variant: "primary" },
          { decision: "reject", label: t("reject"), variant: "secondary" },
        ]
      : status === "approved"
        ? [{ decision: "suspend", label: t("suspend"), variant: "danger" }]
        : status === "suspended"
          ? [{ decision: "reinstate", label: t("reinstate"), variant: "primary" }]
          : [];

  if (!buttons.length) return <p className="text-sm text-muted">—</p>;

  return (
    <form action={action} className="space-y-4">
      {state.ok ? <Alert tone="success" title={t("decisionSaved")} /> : null}
      {state.error ? <Alert tone="danger" title={err(state.error)} /> : null}
      <Field label={t("remarks")} hint={t("remarksHint")}>
        <Textarea name="remarks" maxLength={2000} rows={4} />
      </Field>
      <div className="flex flex-col gap-2">
        {buttons.map((b) => (
          <Button key={b.decision} type="submit" name="decision" value={b.decision} variant={b.variant} disabled={pending}>
            {b.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
