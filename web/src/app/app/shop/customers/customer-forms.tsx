"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { CUSTOMER_CONDITIONS } from "@/lib/retail/constants";
import { deleteCustomer, saveCustomer, type CustomerState } from "./actions";

export type CustomerValues = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  birthYear: string;
  address: string;
  notes: string;
  conditions: string[];
  consent: boolean;
  reminders: boolean;
};

const EMPTY: CustomerValues = {
  name: "",
  phone: "",
  email: "",
  birthYear: "",
  address: "",
  notes: "",
  conditions: [],
  consent: false,
  reminders: false,
};

export function CustomerForm({ values = EMPTY, redirectOnSave }: { values?: CustomerValues; redirectOnSave?: boolean }) {
  const t = useTranslations("shop");
  const te = useTranslations();
  const err = useErrorText();
  const router = useRouter();
  const [state, action, pending] = useActionState<CustomerState, FormData>(saveCustomer, {});

  // A new customer opens their profile once saved.
  const [seen, setSeen] = useState(state.customerId);
  if (state.customerId !== seen) {
    setSeen(state.customerId);
    if (state.ok && redirectOnSave && state.customerId) router.push(`/app/shop/customers/${state.customerId}`);
  }

  return (
    <form action={action} className="space-y-4 p-4 sm:p-5">
      {state.ok && !redirectOnSave ? <Alert tone="success" title={t("customerSaved")} /> : null}
      {state.errors?.form ? <Alert tone="danger" title={err(state.errors.form)} /> : null}
      {values.id ? <input type="hidden" name="customerId" value={values.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("customerName")} error={err(state.errors?.name)}>
          <Input name="name" required maxLength={120} defaultValue={values.name} />
        </Field>
        <Field label={t("customerPhone")} error={err(state.errors?.phone)}>
          <Input name="phone" inputMode="tel" maxLength={10} defaultValue={values.phone} />
        </Field>
        <Field label={t("customerEmail")} hint={t("customerEmailHint")} error={err(state.errors?.email)}>
          <Input name="email" type="email" defaultValue={values.email} />
        </Field>
        <Field label={t("birthYear")} hint={t("birthYearHint")} error={err(state.errors?.birthYear)}>
          <Input name="birthYear" inputMode="numeric" maxLength={4} defaultValue={values.birthYear} />
        </Field>
      </div>

      <Field label={t("customerAddress")}>
        <Input name="address" maxLength={240} defaultValue={values.address} />
      </Field>

      <fieldset>
        <legend className="text-sm font-medium">{t("conditions")}</legend>
        <p className="mt-0.5 text-xs text-muted">{t("conditionsHint")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CUSTOMER_CONDITIONS.map((c) => (
            <label key={c} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm">
              <input type="checkbox" name="conditions" value={c} defaultChecked={values.conditions.includes(c)} className="size-4" />
              {t(`condition.${c}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={t("customerNotes")}>
        <Textarea name="notes" maxLength={500} rows={2} defaultValue={values.notes} />
      </Field>

      <div className="space-y-2 rounded-lg bg-canvas p-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" defaultChecked={values.consent} className="mt-0.5 size-4" required />
          <span>{t("consentText")}</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="reminders" defaultChecked={values.reminders} className="mt-0.5 size-4" />
          <span>{t("remindersConsent")}</span>
        </label>
        {state.errors?.consent ? <Alert tone="danger" title={err(state.errors.consent)} /> : null}
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? te("common.saving") : t("saveCustomer")}
      </Button>
    </form>
  );
}

/** Erasure is irreversible, so it asks first. */
export function DeleteCustomer({ id }: { id: string }) {
  const t = useTranslations("shop");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-red-600 hover:underline">
        {t("deleteCustomer")}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
      <p className="text-red-800">{t("deleteCustomerWarning")}</p>
      <div className="flex gap-2">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await deleteCustomer(id);
              router.push("/app/shop/customers");
            })
          }
        >
          {pending ? t("deleting") : t("deleteCustomerConfirm")}
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
          {t("cancelNewCustomer")}
        </Button>
      </div>
    </div>
  );
}
