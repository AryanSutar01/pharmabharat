"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { PAYMENT_METHODS } from "@/lib/ledger/constants";
import { recordPaymentAction, saveCreditTermsAction, type LedgerFormState } from "../actions";

export function RecordPaymentForm({ buyerId, outstanding, today }: { buyerId: string; outstanding: number; today: string }) {
  const t = useTranslations();
  const err = useErrorText();
  const [state, action, pending] = useActionState<LedgerFormState, FormData>(recordPaymentAction, {});

  return (
    <form action={action} className="space-y-4 p-4 sm:p-5">
      {state.ok ? <Alert tone="success" title={t("ledger.paymentSaved")} /> : null}
      {state.error ? <Alert tone="danger" title={err(state.error)} /> : null}
      <input type="hidden" name="buyerId" value={buyerId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("ledger.amount")} hint={t("ledger.amountHint", { amount: outstanding.toFixed(2) })}>
          <Input name="amount" type="number" min="0.01" step="0.01" max={10000000} required inputMode="decimal" />
        </Field>
        <Field label={t("ledger.method")}>
          <Select name="method" defaultValue="upi">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`ledger.methodLabel.${m}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("ledger.reference")} hint={t("ledger.referenceHint")}>
          <Input name="reference" maxLength={80} autoComplete="off" />
        </Field>
        <Field label={t("ledger.receivedAt")}>
          <Input name="receivedAt" type="date" defaultValue={today} max={today} />
        </Field>
      </div>
      <Field label={t("ledger.note")}>
        <Textarea name="note" maxLength={300} rows={2} />
      </Field>
      <p className="text-xs text-muted">{t("ledger.allocationNote")}</p>
      <Button type="submit" disabled={pending}>
        {pending ? t("common.saving") : t("ledger.recordPayment")}
      </Button>
    </form>
  );
}

export function CreditTermsForm({
  buyerId,
  creditLimit,
  creditDays,
  note,
}: {
  buyerId: string;
  creditLimit: number;
  creditDays: number;
  note: string;
}) {
  const t = useTranslations();
  const err = useErrorText();
  const [state, action, pending] = useActionState<LedgerFormState, FormData>(saveCreditTermsAction, {});

  return (
    <form action={action} className="space-y-4 p-4 sm:p-5">
      {state.ok ? <Alert tone="success" title={t("ledger.termsSaved")} /> : null}
      {state.error ? <Alert tone="danger" title={err(state.error)} /> : null}
      <input type="hidden" name="buyerId" value={buyerId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("ledger.creditLimit")} hint={t("ledger.creditLimitHint")}>
          <Input name="creditLimit" type="number" min="0" step="1" defaultValue={creditLimit} inputMode="numeric" />
        </Field>
        <Field label={t("ledger.creditDays")} hint={t("ledger.creditDaysHint")}>
          <Input name="creditDays" type="number" min="0" max="180" step="1" defaultValue={creditDays} inputMode="numeric" />
        </Field>
      </div>
      <Field label={t("ledger.note")}>
        <Input name="note" maxLength={300} defaultValue={note} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
