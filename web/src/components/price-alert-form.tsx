"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deletePriceAlert, savePriceAlert, type AlertFormState } from "@/app/app/alerts/actions";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { PRICE_DIRECTIONS } from "@/lib/alerts/rules";

export type ExistingAlert = { id: string; direction: string; thresholdPct: number; email: boolean };

/** Collapsible "Alert me on price change" control for the product page. */
export function PriceAlertForm({ productId, existing }: { productId: string; existing: ExistingAlert | null }) {
  const t = useTranslations("alerts");
  const err = useErrorText();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AlertFormState, FormData>(savePriceAlert.bind(null, productId), {});
  const [removing, startRemove] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        {existing ? `🔔 ${t("watching")}` : `🔔 ${t("alertMe")}`}
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-line p-3">
      <p className="text-sm font-medium">{existing ? t("editAlert") : t("alertMe")}</p>
      <Field label={t("direction")}>
        <Select name="direction" defaultValue={existing?.direction ?? "drop"}>
          {PRICE_DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {t(d)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("threshold")} hint={t("thresholdHint")}>
        <Input name="thresholdPct" type="number" min={0} max={90} step={1} defaultValue={existing?.thresholdPct ?? 5} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="email" defaultChecked={existing?.email ?? true} className="size-4 accent-brand-600" />
        {t("email")}
      </label>
      {state.ok ? <Alert tone="success" title={t("saved")} /> : null}
      {state.error ? <Alert tone="danger" title={err(state.error)} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {existing ? (
          <Button
            type="button"
            variant="ghost"
            className="text-red-600"
            disabled={removing}
            onClick={() =>
              startRemove(async () => {
                await deletePriceAlert(existing.id);
                setOpen(false);
              })
            }
          >
            {t("remove")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
