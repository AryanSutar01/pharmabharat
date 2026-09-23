"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, cn } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { CUSTOMER_CONDITIONS } from "@/lib/retail/constants";
import { billLine, billTotals } from "@/lib/retail/gst";
import { redeemPlan, type LoyaltyRules } from "@/lib/retail/loyalty";
import type { ShelfHit } from "@/lib/retail/billing";
import type { CustomerHit } from "@/lib/retail/customers";
import { addCustomer, customerSearch, saveBill, shelfSearch, type CustomerFormState } from "./actions";

type Line = {
  key: string;
  productId: string;
  name: string;
  packSizeLabel: string;
  schedule: string;
  batches: ShelfHit["batches"];
  stockId: string;
  qty: number;
  discountPercent: number;
};

const PAYMENT_MODES = ["cash", "upi", "card"] as const;
/** Schedule H and H1 medicines need the prescriber recorded. */
const RX_SCHEDULES = ["h", "h1", "x"];

export function BillingCounter({ loyalty }: { loyalty: LoyaltyRules }) {
  const t = useTranslations("shop");
  const err = useErrorText();
  const format = useFormatter();
  const router = useRouter();

  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [mode, setMode] = useState<(typeof PAYMENT_MODES)[number]>("cash");
  const [rx, setRx] = useState({ doctorName: "", registrationNo: "", patientName: "" });
  const [usePoints, setUsePoints] = useState(true);
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null);
  const [saving, startSave] = useTransition();

  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const monthYear = (d: string) => format.dateTime(new Date(d), { month: "short", year: "numeric" });

  const priced = lines.map((l) => {
    const batch = l.batches.find((b) => b.stockId === l.stockId)!;
    return { line: l, batch, tax: billLine({ qty: l.qty, mrp: batch.mrp, gstRate: batch.gstRate, discountPercent: l.discountPercent }) };
  });
  const gross = billTotals(priced.map((p) => p.tax)).grandTotal;
  const redeem =
    customer && usePoints
      ? redeemPlan({ balance: customer.points, billTotal: gross, rules: loyalty })
      : { points: 0, value: 0 };
  const totals = billTotals(priced.map((p) => p.tax), redeem.value);
  const needsRx = lines.some((l) => RX_SCHEDULES.includes((l.schedule ?? "").toLowerCase()));

  function addProduct(hit: ShelfHit) {
    setError(null);
    setLines((prev) => {
      // Same batch twice? Just add one more pack.
      const first = hit.batches[0];
      const existing = prev.find((l) => l.stockId === first.stockId);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, qty: Math.min(l.qty + 1, first.qty) } : l));
      }
      return [
        ...prev,
        {
          key: `${first.stockId}-${Date.now()}`,
          productId: hit.productId,
          name: hit.name,
          packSizeLabel: hit.packSizeLabel,
          schedule: hit.schedule,
          batches: hit.batches,
          stockId: first.stockId,
          qty: 1,
          discountPercent: 0,
        },
      ];
    });
  }

  const patch = (key: string, change: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...change } : l)));

  function save() {
    setError(null);
    startSave(async () => {
      const res = await saveBill({
        lines: lines.map((l) => ({ stockId: l.stockId, qty: l.qty, discountPercent: l.discountPercent })),
        customerId: customer?.id,
        redeemPoints: redeem.points || undefined,
        payment: { mode },
        prescription: needsRx ? rx : undefined,
      });
      if (res.billId) router.push(`/app/shop/bills/${res.billId}`);
      else setError({ code: res.error ?? "generic", detail: res.detail });
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5">
        <Card>
          <CardHeader title={t("counterSearch")} description={t("counterSearchHint")} />
          <div className="p-4 sm:p-5">
            <ShelfSearch onPick={addProduct} />
          </div>
        </Card>

        <Card>
          <CardHeader title={t("billLines", { count: lines.length })} />
          {lines.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">{t("billEmpty")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {priced.map(({ line, batch, tax }) => (
                <li key={line.key} className="space-y-2 px-4 py-3 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{line.name}</p>
                      <p className="text-xs text-muted">
                        {line.packSizeLabel} · {t("mrp")} {inr(batch.mrp)} · {t("gst")} {batch.gstRate}%
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="shrink-0 text-xs text-muted hover:text-red-600"
                    >
                      {t("remove")}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs text-muted">
                      {t("batch")}
                      <Select
                        value={line.stockId}
                        onChange={(e) => patch(line.key, { stockId: e.target.value, qty: 1 })}
                        className="mt-1 h-9 w-44 text-sm"
                      >
                        {line.batches.map((b) => (
                          <option key={b.stockId} value={b.stockId}>
                            {b.batchNo} · {monthYear(b.expiryDate)} · {b.qty}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="text-xs text-muted">
                      {t("qty")}
                      <Input
                        type="number"
                        min={1}
                        max={batch.qty}
                        value={line.qty}
                        onChange={(e) => patch(line.key, { qty: Math.min(Math.max(Number(e.target.value) || 1, 1), batch.qty) })}
                        className="mt-1 h-9 w-20 text-sm"
                      />
                    </label>
                    <label className="text-xs text-muted">
                      {t("discountPercent")}
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={line.discountPercent}
                        onChange={(e) =>
                          patch(line.key, { discountPercent: Math.min(Math.max(Number(e.target.value) || 0, 0), 100) })
                        }
                        className="mt-1 h-9 w-20 text-sm"
                      />
                    </label>
                    <span className="ml-auto text-right">
                      <span className="block text-xs text-muted">{t("lineTotal")}</span>
                      <b className="tabular-nums">{inr(tax.total)}</b>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {needsRx ? (
          <Card>
            <CardHeader title={t("rxTitle")} description={t("rxHint")} />
            <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
              <Field label={t("rxDoctor")}>
                <Input value={rx.doctorName} onChange={(e) => setRx({ ...rx, doctorName: e.target.value })} maxLength={120} />
              </Field>
              <Field label={t("rxRegNo")}>
                <Input
                  value={rx.registrationNo}
                  onChange={(e) => setRx({ ...rx, registrationNo: e.target.value })}
                  maxLength={60}
                />
              </Field>
              <Field label={t("rxPatient")}>
                <Input value={rx.patientName} onChange={(e) => setRx({ ...rx, patientName: e.target.value })} maxLength={120} />
              </Field>
            </div>
          </Card>
        ) : null}
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title={t("customer")} />
          <div className="p-4 sm:p-5">
            <CustomerBox customer={customer} onChange={setCustomer} />
          </div>
        </Card>

        <Card className="xl:sticky xl:top-4">
          <CardHeader title={t("payment")} />
          <div className="space-y-3 p-4 text-sm sm:p-5">
            <div className="flex gap-2">
              {PAYMENT_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
                    m === mode ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-muted",
                  )}
                >
                  {t(`payMode.${m}`)}
                </button>
              ))}
            </div>
            {customer && loyalty.active && customer.points >= loyalty.minRedeemPoints ? (
              <label className="flex items-start gap-2 rounded-lg bg-brand-50 p-2.5 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={usePoints}
                  onChange={(e) => setUsePoints(e.target.checked)}
                />
                <span>{t("usePoints", { points: customer.points, value: inr(redeem.value) })}</span>
              </label>
            ) : null}
            <dl className="space-y-1 border-t border-line pt-3">
              <Row label={t("subtotal")} value={inr(totals.gross)} />
              {totals.discount ? <Row label={t("discount")} value={`− ${inr(totals.discount)}`} /> : null}
              <Row label={t("taxable")} value={inr(totals.taxable)} />
              <Row label={`${t("cgst")} + ${t("sgst")}`} value={inr(totals.tax)} />
              {redeem.points ? <Row label={t("pointsUsed", { points: redeem.points })} value={`− ${inr(redeem.value)}`} /> : null}
              {totals.roundOff ? <Row label={t("roundOff")} value={inr(totals.roundOff)} /> : null}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <dt>{t("payable")}</dt>
                <dd className="tabular-nums">{inr(totals.grandTotal)}</dd>
              </div>
            </dl>
            {error ? <Alert tone="danger" title={`${err(error.code)}${error.detail ? ` — ${error.detail}` : ""}`} /> : null}
            <Button onClick={save} disabled={saving || !lines.length} className="w-full">
              {saving ? t("savingBill") : t("saveAndPrint")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function ShelfSearch({ onPick }: { onPick: (hit: ShelfHit) => void }) {
  const t = useTranslations("shop");
  const format = useFormatter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ShelfHit[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await shelfSearch(term);
        if (mine === seq.current) setHits(rows);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const visible = q.trim().length >= 2 ? hits : [];

  return (
    <div className="space-y-3">
      <Input
        ref={box}
        type="search"
        value={q}
        autoFocus
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("counterPlaceholder")}
        className="h-12 text-base"
      />
      {loading && !visible.length ? <p className="text-sm text-muted">…</p> : null}
      {visible.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {visible.map((h) => (
            <li key={h.productId}>
              <button
                type="button"
                onClick={() => {
                  onPick(h);
                  setQ("");
                  box.current?.focus();
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-canvas"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{h.name}</span>
                  <span className="block text-xs text-muted">
                    {[h.manufacturer, h.packSizeLabel].filter(Boolean).join(" · ")} · {t("batch")} {h.batches[0].batchNo} ·{" "}
                    {t("exp")} {format.dateTime(new Date(h.batches[0].expiryDate), { month: "short", year: "numeric" })}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <b className="block text-sm tabular-nums">
                    {format.number(h.batches[0].mrp, { style: "currency", currency: "INR", maximumFractionDigits: 2 })}
                  </b>
                  <span className="text-muted">{t("inStock", { count: h.totalQty })}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : q.trim().length >= 2 && !loading ? (
        <p className="text-sm text-muted">{t("notOnShelf")}</p>
      ) : null}
    </div>
  );
}

function CustomerBox({ customer, onChange }: { customer: CustomerHit | null; onChange: (c: CustomerHit | null) => void }) {
  const t = useTranslations("shop");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [adding, setAdding] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      const rows = await customerSearch(term);
      if (mine === seq.current) setHits(rows);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const visible = q.trim().length >= 3 ? hits : [];

  if (customer) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{customer.name}</p>
          <p className="text-xs text-muted">{customer.phone || t("noPhone")}</p>
          {customer.points > 0 ? <p className="text-xs text-brand-700">{t("pointsBalance", { points: customer.points })}</p> : null}
          <div className="mt-1 flex flex-wrap gap-1">
            {customer.conditions.map((c) => (
              <Badge key={c} tone="info">
                {t(`condition.${c}`)}
              </Badge>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 text-xs text-brand-700 hover:underline">
          {t("changeCustomer")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("customerPlaceholder")}
        inputMode="tel"
      />
      {visible.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {visible.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c);
                  setQ("");
                }}
                className="w-full px-3 py-2 text-left hover:bg-canvas"
              >
                <span className="block text-sm font-medium">{c.name}</span>
                <span className="block text-xs text-muted">
                  {c.phone} · {t("visits", { count: c.visits })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={() => setAdding((a) => !a)} className="text-sm text-brand-700 hover:underline">
        {adding ? t("cancelNewCustomer") : t("newCustomer")}
      </button>
      {adding ? <NewCustomerForm phone={/^\d+$/.test(q.trim()) ? q.trim() : ""} onCreated={onChange} /> : null}
      <p className="text-xs text-muted">{t("customerOptional")}</p>
    </div>
  );
}

function NewCustomerForm({ phone, onCreated }: { phone: string; onCreated: (c: CustomerHit) => void }) {
  const t = useTranslations("shop");
  const te = useTranslations();
  const err = useErrorText();
  const [state, action, pending] = useActionState<CustomerFormState, FormData>(addCustomer, {});

  // The action returns the saved customer; hand it to the bill.
  const [seen, setSeen] = useState(state.customer);
  if (state.customer !== seen) {
    setSeen(state.customer);
    if (state.customer) onCreated(state.customer);
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-line p-3">
      <Field label={t("customerName")} error={err(state.errors?.name)}>
        <Input name="name" required maxLength={120} autoComplete="off" />
      </Field>
      <Field label={t("customerPhone")} error={err(state.errors?.phone)}>
        <Input name="phone" inputMode="tel" maxLength={10} defaultValue={phone} autoComplete="off" />
      </Field>
      <Field label={t("customerEmail")} hint={t("customerEmailHint")} error={err(state.errors?.email)}>
        <Input name="email" type="email" autoComplete="off" />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium">{t("conditions")}</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {CUSTOMER_CONDITIONS.map((c) => (
            <label key={c} className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs">
              <input type="checkbox" name="conditions" value={c} className="size-3.5" />
              {t(`condition.${c}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" name="consent" className="mt-0.5 size-4" required />
        <span>{t("consentText")}</span>
      </label>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" name="reminders" className="mt-0.5 size-4" />
        <span>{t("remindersConsent")}</span>
      </label>
      {state.errors?.consent ? <Alert tone="danger" title={err(state.errors.consent)} /> : null}
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? te("common.saving") : t("saveCustomer")}
      </Button>
    </form>
  );
}
