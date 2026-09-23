"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Select, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { PAYMENT_MODES } from "@/lib/orders/status";
import { applyCheapest, checkout, setCartQty, type CartActionResult } from "./actions";

export function CartQty({ listingId, qty }: { listingId: string; qty: number }) {
  const t = useTranslations("cart");
  const [value, setValue] = useState(String(qty));
  const [pending, start] = useTransition();
  const commit = (n: number) => start(async () => void (await setCartQty(listingId, n)));

  return (
    <div className="flex items-center gap-2">
      <input
        aria-label={t("qty")}
        inputMode="numeric"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        onBlur={() => {
          const n = Number(value);
          if (Number.isInteger(n) && n > 0 && n !== qty) commit(n);
          else setValue(String(qty));
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-9 w-16 rounded-md border border-line bg-white px-2 text-right text-base tabular-nums sm:text-sm"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => commit(0)}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {t("remove")}
      </button>
    </div>
  );
}

export function CheckoutForm({ orderCount, blocked }: { orderCount: number; blocked: boolean }) {
  const t = useTranslations("cart");
  const err = useErrorText();
  const [state, action, pending] = useActionState<CartActionResult, FormData>(checkout, {});

  return (
    <form action={action} className="space-y-4">
      <Field label={t("paymentMode")}>
        <Select name="paymentMode" defaultValue="credit">
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {t(m)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("notes")}>
        <Textarea name="notes" maxLength={500} rows={2} placeholder={t("notesPlaceholder")} />
      </Field>
      {orderCount > 1 ? <p className="text-sm text-muted">{t("splitNote", { count: orderCount })}</p> : null}
      {state.error ? <Alert tone="danger" title={err(state.error)} /> : null}
      {blocked ? <Alert tone="warning" title={t("fixIssues")} /> : null}
      <Button type="submit" className="h-12 w-full text-base" disabled={blocked || pending}>
        {pending ? t("placing") : t("placeOrder")}
      </Button>
      <p className="text-center text-xs text-muted">{t("stockReserved")}</p>
    </form>
  );
}

/** "Switch to the cheapest sellers" button under the savings card. */
export function ApplyCheapest({ label, busyLabel }: { label: string; busyLabel: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => start(async () => void (await applyCheapest()))}>
      {pending ? busyLabel : label}
    </Button>
  );
}
