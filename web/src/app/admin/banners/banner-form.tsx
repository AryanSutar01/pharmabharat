"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { createBanner, type AdminFormState } from "../actions";

const AUDIENCES = ["all", "retailer", "wholesaler", "company"] as const;
const TONES = ["info", "success", "warning"] as const;

export function BannerForm() {
  const t = useTranslations("admin");
  const err = useErrorText();
  const [state, action, pending] = useActionState<AdminFormState, FormData>(createBanner, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("titleEn")}>
          <Input name="titleEn" required maxLength={120} />
        </Field>
        <Field label={t("titleHi")}>
          <Input name="titleHi" maxLength={120} />
        </Field>
        <Field label={t("titleMr")}>
          <Input name="titleMr" maxLength={120} />
        </Field>
        <Field label={t("bodyEn")}>
          <Textarea name="bodyEn" rows={2} maxLength={400} />
        </Field>
        <Field label={t("bodyHi")}>
          <Textarea name="bodyHi" rows={2} maxLength={400} />
        </Field>
        <Field label={t("bodyMr")}>
          <Textarea name="bodyMr" rows={2} maxLength={400} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label={t("link")} className="sm:col-span-2">
          <Input name="link" maxLength={300} />
        </Field>
        <Field label={t("audience")}>
          <Select name="audience" defaultValue="all">
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {t(`audienceLabel.${a}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("tone")}>
          <Select name="tone" defaultValue="info">
            {TONES.map((x) => (
              <option key={x} value={x}>
                {t(`toneLabel.${x}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t("startsAt")}>
            <Input name="startsAt" type="date" />
          </Field>
          <Field label={t("endsAt")}>
            <Input name="endsAt" type="date" />
          </Field>
        </div>
      </div>
      {state.ok ? <Alert tone="success" title={t("saved")} /> : null}
      {state.error ? <Alert tone="danger" title={err(state.error)} /> : null}
      <Button type="submit" disabled={pending}>
        {t("createBanner")}
      </Button>
    </form>
  );
}
