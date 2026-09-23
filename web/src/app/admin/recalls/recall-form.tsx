"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { RECALL_SEVERITIES } from "@/lib/recalls/constants";
import { createRecall, revokeRecall, type RecallFormState } from "./actions";

export function RecallForm() {
  const t = useTranslations("admin");
  const err = useErrorText();
  const [state, action, pending] = useActionState<RecallFormState, FormData>(createRecall, {});
  const v = state.values ?? {};

  return (
    <form action={action} className="space-y-4 p-4 sm:p-5">
      {state.ok && state.stats ? <Alert tone="success" title={t("recallSent", state.stats)} /> : null}
      {state.error ? <Alert tone="danger" title={err(state.error)} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("recallProduct")} hint={t("recallProductHint")}>
          <Input name="productName" required minLength={3} maxLength={200} defaultValue={v.productName} />
        </Field>
        <Field label={t("recallManufacturer")}>
          <Input name="manufacturer" maxLength={200} defaultValue={v.manufacturer} />
        </Field>
        <Field label={t("recallBatch")} hint={t("recallBatchHint")}>
          <Input name="batchNo" required maxLength={40} className="uppercase" defaultValue={v.batchNo} />
        </Field>
        <Field label={t("recallSeverity")}>
          <Select name="severity" defaultValue={v.severity ?? "recall"}>
            {RECALL_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {t(`recallSeverityLabel.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("recallReason")}>
        <Textarea name="reason" required minLength={10} maxLength={1000} rows={3} defaultValue={v.reason} />
      </Field>
      <Field label={t("recallReference")} hint={t("recallReferenceHint")}>
        <Input name="reference" maxLength={300} defaultValue={v.reference} />
      </Field>
      <Alert tone="warning" title={t("recallWarning")} />
      <Button type="submit" disabled={pending}>
        {pending ? t("recallSending") : t("recallIssue")}
      </Button>
    </form>
  );
}

export function WithdrawButton({ id }: { id: string }) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => start(async () => void (await revokeRecall(id)))}
    >
      {pending ? t("recallWithdrawing") : t("recallWithdraw")}
    </Button>
  );
}
