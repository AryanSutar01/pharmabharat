"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Input } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { saveShopSettings, type SettingsState } from "./actions";

export type SettingsValues = {
  reorderCoverDays: number;
  retentionMonths: number;
  loyaltyActive: boolean;
  pointsPerHundred: number;
  pointValue: number;
  minRedeemPoints: number;
  expiryMonths: number;
};

export function SettingsForm({ values }: { values: SettingsValues }) {
  const t = useTranslations("shop");
  const te = useTranslations();
  const err = useErrorText();
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveShopSettings, {});
  const [loyalty, setLoyalty] = useState(values.loyaltyActive);

  return (
    <form action={action} className="space-y-6 p-4 sm:p-5">
      {state.ok ? <Alert tone="success" title={t("settingsSaved")} /> : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">{t("stockSettings")}</h2>
        <Field label={t("coverDays")} hint={t("coverDaysHint")} error={err(state.errors?.reorderCoverDays)}>
          <Input name="reorderCoverDays" type="number" min="1" max="120" defaultValue={values.reorderCoverDays} inputMode="numeric" />
        </Field>
      </section>

      <section className="space-y-4 border-t border-line pt-5">
        <h2 className="text-sm font-semibold">{t("loyaltyTitle")}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="loyaltyActive"
            className="size-4"
            checked={loyalty}
            onChange={(e) => setLoyalty(e.target.checked)}
          />
          {t("loyaltyActive")}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("pointsPerHundred")} hint={t("pointsPerHundredHint")} error={err(state.errors?.pointsPerHundred)}>
            <Input name="pointsPerHundred" type="number" min="0" max="100" step="0.5" defaultValue={values.pointsPerHundred} />
          </Field>
          <Field label={t("pointValue")} hint={t("pointValueHint")} error={err(state.errors?.pointValue)}>
            <Input name="pointValue" type="number" min="0" max="100" step="0.25" defaultValue={values.pointValue} />
          </Field>
          <Field label={t("minRedeem")} hint={t("minRedeemHint")} error={err(state.errors?.minRedeemPoints)}>
            <Input name="minRedeemPoints" type="number" min="0" max="100000" defaultValue={values.minRedeemPoints} />
          </Field>
          <Field label={t("pointExpiry")} hint={t("pointExpiryHint")} error={err(state.errors?.expiryMonths)}>
            <Input name="expiryMonths" type="number" min="1" max="120" defaultValue={values.expiryMonths} />
          </Field>
        </div>
        <p className="rounded-lg bg-canvas p-3 text-xs text-muted">
          {t("loyaltyExample", {
            spend: 1000,
            points: Math.floor(10 * values.pointsPerHundred),
            value: Math.floor(10 * values.pointsPerHundred) * values.pointValue,
          })}
        </p>
      </section>

      <section className="space-y-4 border-t border-line pt-5">
        <h2 className="text-sm font-semibold">{t("privacyTitle")}</h2>
        <Field label={t("retention")} hint={t("retentionHint")} error={err(state.errors?.retentionMonths)}>
          <Input name="retentionMonths" type="number" min="6" max="120" defaultValue={values.retentionMonths} inputMode="numeric" />
        </Field>
      </section>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? te("common.saving") : te("common.save")}
      </Button>
    </form>
  );
}
