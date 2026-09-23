"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { GST_RATES } from "@/lib/catalog/constants";
import { addShopStock, deleteShopStock, updateShopStockQty, type StockFormState } from "./actions";

type PickedProduct = { id: string; name: string; manufacturer: string; packSizeLabel: string; mrp?: number };

/** Add a batch to the shelf: find the medicine, then fill in the batch details. */
export function AddStockForm() {
  const t = useTranslations("shop");
  const te = useTranslations();
  const err = useErrorText();
  const [state, action, pending] = useActionState<StockFormState, FormData>(addShopStock, {});
  const [picked, setPicked] = useState<PickedProduct | null>(null);
  const e = (k: string) => err(state.errors?.[k]);
  const v = state.values ?? {};

  // After a successful save, clear the picker so the next batch starts fresh.
  const [sawOk, setSawOk] = useState(state.ok);
  if (state.ok !== sawOk) {
    setSawOk(state.ok);
    if (state.ok) setPicked(null);
  }

  if (!picked) {
    return (
      <div className="space-y-3 p-4 sm:p-5">
        {state.ok ? <Alert tone="success" title={t("stockAdded")} /> : null}
        <ProductPicker onPick={setPicked} />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 p-4 sm:p-5">
      {state.errors?.form ? <Alert tone="danger" title={err(state.errors.form)} /> : null}
      <input type="hidden" name="productId" value={picked.id} />
      <div className="flex items-start justify-between gap-3 rounded-lg bg-canvas px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{picked.name}</p>
          <p className="truncate text-xs text-muted">
            {picked.manufacturer} · {picked.packSizeLabel}
          </p>
        </div>
        <button type="button" onClick={() => setPicked(null)} className="shrink-0 text-xs text-brand-700 hover:underline">
          {t("changeProduct")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("batchNo")} error={e("batchNo")}>
          <Input name="batchNo" required maxLength={30} className="uppercase" defaultValue={v.batchNo} />
        </Field>
        <Field label={t("expiry")} error={e("expiryDate")}>
          <Input name="expiryDate" type="date" required defaultValue={v.expiryDate} />
        </Field>
        <Field label={t("qtyPacks")} hint={t("qtyPacksHint")} error={e("qty")}>
          <Input name="qty" type="number" min="0" step="1" required inputMode="numeric" defaultValue={v.qty ?? "1"} />
        </Field>
        <Field label={t("mrp")} error={e("mrp")}>
          <Input name="mrp" type="number" min="0" step="0.01" required inputMode="decimal" defaultValue={v.mrp ?? picked.mrp} />
        </Field>
        <Field label={t("cost")} hint={t("costHint")} error={e("cost")}>
          <Input name="cost" type="number" min="0" step="0.01" required inputMode="decimal" defaultValue={v.cost} />
        </Field>
        <Field label={t("gst")} error={e("gstRate")}>
          <Select name="gstRate" defaultValue={v.gstRate ?? "5"}>
            {GST_RATES.map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("hsn")} error={e("hsn")}>
          <Input name="hsn" maxLength={8} inputMode="numeric" defaultValue={v.hsn} />
        </Field>
        <Field label={t("supplier")} hint={t("supplierHint")} error={e("supplierName")}>
          <Input name="supplierName" maxLength={120} defaultValue={v.supplierName} />
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? te("common.saving") : t("addToShelf")}
      </Button>
    </form>
  );
}

function ProductPicker({ onPick }: { onPick: (p: PickedProduct) => void }) {
  const t = useTranslations("shop");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products/suggest?q=${encodeURIComponent(term)}`);
        const json = (await res.json()) as { items?: PickedProduct[] };
        if (mine === seq.current) setItems(json.items ?? []);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const visible = q.trim().length >= 2 ? items : [];

  return (
    <div className="space-y-3">
      <Field label={t("findMedicine")} hint={t("findMedicineHint")}>
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Dolo 650, paracetamol…"
          autoComplete="off"
        />
      </Field>
      {loading && !visible.length ? <p className="text-sm text-muted">…</p> : null}
      {visible.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {visible.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p)} className="w-full px-3 py-2.5 text-left hover:bg-canvas">
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-muted">
                  {p.manufacturer} · {p.packSizeLabel}
                  {p.mrp ? ` · MRP ₹${p.mrp}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Correct a count on the shelf, or drop a batch that was never really there. */
export function StockRowControls({ id, qty }: { id: string; qty: number }) {
  const t = useTranslations("shop");
  const [value, setValue] = useState(String(qty));
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <input
        aria-label={t("qtyPacks")}
        inputMode="numeric"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        onBlur={() => {
          const n = Number(value);
          if (Number.isInteger(n) && n >= 0 && n !== qty) start(async () => void (await updateShopStockQty(id, n)));
          else setValue(String(qty));
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-9 w-16 rounded-md border border-line bg-white px-2 text-right text-base tabular-nums sm:text-sm"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await deleteShopStock(id)))}
        className="text-xs text-muted hover:text-red-600"
      >
        {t("remove")}
      </button>
    </div>
  );
}
