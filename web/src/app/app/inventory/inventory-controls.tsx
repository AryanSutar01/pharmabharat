"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, buttonClass } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { deleteListing, importListingsCsv, setListingStatus, updateStock, type CsvImportState } from "./actions";

export function ListingActions({ id, status }: { id: string; status: "active" | "paused" }) {
  const t = useTranslations("inventory");
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1">
      <Link href={`/app/inventory/${id}`} className={buttonClass("ghost", "h-8 px-2 text-xs")}>
        {t("edit")}
      </Link>
      <Button
        variant="ghost"
        className="h-8 px-2 text-xs"
        disabled={pending}
        onClick={() => start(() => setListingStatus(id, status === "active" ? "paused" : "active"))}
      >
        {status === "active" ? t("pause") : t("resume")}
      </Button>
      <Button
        variant="ghost"
        className="h-8 px-2 text-xs text-red-600"
        disabled={pending}
        onClick={() => {
          if (confirm(t("confirmDelete"))) start(() => deleteListing(id));
        }}
      >
        {t("delete")}
      </Button>
    </div>
  );
}

/** Inline stock editor: type a number, press Enter or leave the field. */
export function StockInput({ id, stock }: { id: string; stock: number }) {
  const [value, setValue] = useState(String(stock));
  const [pending, start] = useTransition();
  const commit = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n === stock) return setValue(String(stock));
    start(async () => void (await updateStock(id, n)));
  };
  return (
    <input
      aria-label="Stock"
      inputMode="numeric"
      value={value}
      disabled={pending}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), e.preventDefault())}
      className="h-8 w-20 rounded-md border border-line bg-white px-2 text-right text-base tabular-nums sm:text-sm"
    />
  );
}

export function CsvImport() {
  const t = useTranslations("inventory");
  const err = useErrorText();
  const [state, action, pending] = useActionState<CsvImportState, FormData>(importListingsCsv, {});

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">{t("csvHelp")}</p>
      <a href="/templates/listings-template.csv" download className="inline-block text-sm text-brand-700 hover:underline">
        ↓ {t("csvTemplate")}
      </a>
      <Field label={t("csvFile")}>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm"
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : t("csvImport")}
      </Button>
      {state.message ? <Alert tone="danger" title={err(state.message)} /> : null}
      {state.ok ? (
        <Alert tone={state.errors?.length ? "warning" : "success"} title={t("csvResult", { created: state.created ?? 0, updated: state.updated ?? 0 })}>
          {state.errors?.length ? (
            <>
              <p className="font-medium">{t("csvErrors")}</p>
              <ul className="mt-1 list-inside list-disc">
                {state.errors.map((e, i) => (
                  <li key={i}>
                    {e.row ? `${t("csvRow", { row: e.row })} · ` : ""}
                    {e.field}: {err(e.code)}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Alert>
      ) : null}
    </form>
  );
}
