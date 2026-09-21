"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input, cn } from "@/components/ui";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/permissions";
import { createBusiness, type FormState } from "./actions";
import { useErrorText } from "@/components/use-error-text";

export function CreateBusinessForm() {
  const t = useTranslations();
  const err = useErrorText();
  const [type, setType] = useState<BusinessType>("retailer");
  const [state, action, pending] = useActionState<FormState, FormData>(createBusiness, {});

  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="text-sm font-medium">{t("onboarding.createTitle")}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {BUSINESS_TYPES.map((bt) => (
            <label
              key={bt}
              className={cn(
                "cursor-pointer rounded-xl border bg-white p-4 transition-colors",
                type === bt ? "border-brand-600 ring-2 ring-brand-500/30" : "border-line hover:border-brand-200",
              )}
            >
              <input
                type="radio"
                name="type"
                value={bt}
                checked={type === bt}
                onChange={() => setType(bt)}
                className="sr-only"
              />
              <span className="block font-semibold">{t(`businessType.${bt}`)}</span>
              <span className="mt-1 block text-sm text-muted">{t(`businessTypeHelp.${bt}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={t("onboarding.legalName")} hint={t("onboarding.legalNameHint")} error={err(state.errors?.legalName)}>
        <Input name="legalName" required minLength={2} maxLength={200} autoComplete="organization" />
      </Field>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? t("common.saving") : t("onboarding.create")}
      </Button>
    </form>
  );
}
