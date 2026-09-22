"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { saveCondition, type AdminFormState } from "../actions";

export type ConditionValues = { slug: string; en: string; hi: string; mr: string; salts: string[]; active: boolean };

export function ConditionForm({ values }: { values?: ConditionValues }) {
  const t = useTranslations("admin");
  const err = useErrorText();
  const [state, action, pending] = useActionState<AdminFormState, FormData>(saveCondition, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("slug")}>
          {values ? (
            <>
              <input type="hidden" name="slug" value={values.slug} />
              <Input value={values.slug} disabled className="font-mono" />
            </>
          ) : (
            <Input name="slug" required pattern="[a-z0-9-]{2,40}" className="font-mono lowercase" />
          )}
        </Field>
        <Field label={t("nameEn")}>
          <Input name="en" defaultValue={values?.en} required />
        </Field>
        <Field label={t("nameHi")}>
          <Input name="hi" defaultValue={values?.hi} />
        </Field>
        <Field label={t("nameMr")}>
          <Input name="mr" defaultValue={values?.mr} />
        </Field>
      </div>
      <Field label={t("salts")}>
        <Textarea name="salts" rows={4} defaultValue={values?.salts.join("\n")} className="font-mono text-sm" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={values?.active ?? true} className="size-4 accent-brand-600" />
        {t("active")}
      </label>
      {state.ok ? <Alert tone="success" title={t("saved")} /> : null}
      {state.error ? <Alert tone="danger" title={err(state.error)} /> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "…" : t("saveCondition")}
      </Button>
    </form>
  );
}
