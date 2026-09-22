"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Card, CardHeader, Field, Input, Select, cn } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { DRUG_SCHEDULES, GST_RATES, STORAGE_CONDITIONS } from "@/lib/catalog/constants";
import { DOSAGE_FORMS, marginPercent } from "@/lib/catalog/normalize";
import {
  createSellerProduct,
  saveListing,
  type ListingFormState,
  type NewProductState,
} from "./actions";

export type PickedProduct = { id: string; name: string; manufacturer?: string; packSizeLabel?: string; mrp: number; hsn?: string; gstRate?: number };

export type ListingDefaults = {
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  mrp: string;
  price: string;
  gstRate: string;
  hsn: string;
  stock: string;
  minOrderQty: string;
  storage: string;
  schedule: string;
  conditions: string[];
};

export function ListingForm({
  listingId,
  product: initialProduct,
  defaults,
  conditions,
}: {
  listingId: string | null;
  product: PickedProduct | null;
  defaults: ListingDefaults;
  conditions: { slug: string; label: string }[];
}) {
  const t = useTranslations("inventory");
  const te = useTranslations();
  const err = useErrorText();
  const [state, action, pending] = useActionState<ListingFormState, FormData>(saveListing.bind(null, listingId), {});
  const [product, setProduct] = useState<PickedProduct | null>(initialProduct);
  const v = state.values;
  const [mrp, setMrp] = useState(v?.mrp ?? defaults.mrp);
  const [price, setPrice] = useState(v?.price ?? defaults.price);
  const [hsn, setHsn] = useState(v?.hsn ?? defaults.hsn);
  const [gstRate, setGstRate] = useState(v?.gstRate ?? defaults.gstRate);
  const e = (k: string) => err(state.errors?.[k]);
  const margin = marginPercent(Number(mrp), Number(price));

  function pick(p: PickedProduct) {
    setProduct(p);
    // Prefill from the master; the seller can still override.
    if (!listingId) {
      if (p.mrp) setMrp(String(p.mrp));
      if (p.hsn) setHsn(p.hsn);
      if (p.gstRate !== undefined) setGstRate(String(p.gstRate));
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t("findProduct")} />
        <div className="p-4 sm:p-5">
          {product ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
              <div className="min-w-0">
                <p className="font-medium">{product.name}</p>
                {product.manufacturer ? (
                  <p className="text-xs text-muted">
                    {product.manufacturer} · {product.packSizeLabel}
                  </p>
                ) : null}
              </div>
              {!listingId ? (
                <button type="button" className="shrink-0 text-sm text-brand-700 hover:underline" onClick={() => setProduct(null)}>
                  {t("change")}
                </button>
              ) : null}
            </div>
          ) : (
            <ProductPicker onPick={pick} />
          )}
          {e("productId") ? <p className="mt-2 text-xs text-red-600">{e("productId")}</p> : null}
        </div>
      </Card>

      {product ? (
        <form action={action} className="space-y-5" noValidate>
          <input type="hidden" name="productId" value={product.id} />
          {state.message ? <Alert tone="danger" title={err(state.message)} /> : null}
          <Card>
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
              <Field label={t("batchNo")} error={e("batchNo")}>
                <Input name="batchNo" defaultValue={v?.batchNo ?? defaults.batchNo} className="uppercase" required maxLength={30} />
              </Field>
              <Field label={<>{t("mfgDate")} <span className="font-normal text-muted">({te("common.optional")})</span></>} error={e("mfgDate")}>
                <Input name="mfgDate" type="date" defaultValue={v?.mfgDate ?? defaults.mfgDate} />
              </Field>
              <Field label={t("expiryDate")} error={e("expiryDate")}>
                <Input name="expiryDate" type="date" defaultValue={v?.expiryDate ?? defaults.expiryDate} required />
              </Field>
              <Field label={t("mrp")} error={e("mrp")}>
                <Input name="mrp" inputMode="decimal" value={mrp} onChange={(ev) => setMrp(ev.target.value)} required />
              </Field>
              <Field
                label={t("price")}
                error={e("price")}
                hint={Number(mrp) > 0 && Number(price) > 0 ? t("marginPreview", { value: margin }) : undefined}
              >
                <Input name="price" inputMode="decimal" value={price} onChange={(ev) => setPrice(ev.target.value)} required />
              </Field>
              <Field label={t("gstRate")} error={e("gstRate")}>
                <Select name="gstRate" value={gstRate} onChange={(ev) => setGstRate(ev.target.value)}>
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("hsn")} error={e("hsn")}>
                <Input name="hsn" inputMode="numeric" value={hsn} onChange={(ev) => setHsn(ev.target.value)} maxLength={8} required />
              </Field>
              <Field label={t("stock")} error={e("stock")}>
                <Input name="stock" inputMode="numeric" defaultValue={v?.stock ?? defaults.stock} required />
              </Field>
              <Field label={t("minOrderQty")} error={e("minOrderQty")}>
                <Input name="minOrderQty" inputMode="numeric" defaultValue={v?.minOrderQty ?? defaults.minOrderQty} />
              </Field>
              <Field label={t("storage")} error={e("storage")}>
                <Select name="storage" defaultValue={v?.storage ?? defaults.storage}>
                  {STORAGE_CONDITIONS.map((s) => (
                    <option key={s} value={s}>
                      {te(`storage.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("schedule")} error={e("schedule")}>
                <Select name="schedule" defaultValue={v?.schedule ?? defaults.schedule} required>
                  <option value="">—</option>
                  {DRUG_SCHEDULES.map((s) => (
                    <option key={s} value={s}>
                      {te(`schedule.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("conditions")} description={t("conditionsHint")} />
            <div className="flex flex-wrap gap-2 p-4 sm:p-5">
              {conditions.map((c) => (
                <label key={c.slug} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="conditions"
                    value={c.slug}
                    defaultChecked={defaults.conditions.includes(c.slug)}
                    className="peer sr-only"
                  />
                  <span className="inline-block rounded-full border border-line bg-white px-3 py-1.5 text-sm text-muted peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40">
                    {c.label}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? te("common.saving") : t("save")}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ProductPicker({ onPick }: { onPick: (p: PickedProduct) => void }) {
  const t = useTranslations("inventory");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
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
      <Field label={t("findProduct")} hint={t("findProductHint")}>
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Dolo 650, paracetamol…"
          autoComplete="off"
          autoFocus
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
                  {p.manufacturer} · {p.packSizeLabel} · MRP ₹{p.mrp}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={() => setShowNew((s) => !s)} className="text-sm text-brand-700 hover:underline">
        {t("notInList")}
      </button>
      {showNew ? <NewProductForm onCreated={onPick} /> : null}
    </div>
  );
}

function NewProductForm({ onCreated }: { onCreated: (p: PickedProduct) => void }) {
  const t = useTranslations("inventory");
  const te = useTranslations();
  const err = useErrorText();
  const [state, action, pending] = useActionState<NewProductState, FormData>(createSellerProduct, {});
  const e = (k: string) => err(state.errors?.[k]);

  useEffect(() => {
    if (state.product) onCreated({ ...state.product, hsn: "3004", gstRate: 5 });
  }, [state.product, onCreated]);

  return (
    <form action={action} className={cn("space-y-4 rounded-lg border border-line bg-canvas p-4")} noValidate>
      <div>
        <p className="font-medium">{t("newProductTitle")}</p>
        <p className="text-xs text-muted">{t("newProductHint")}</p>
      </div>
      <Field label={t("productName")} error={e("name")}>
        <Input name="name" required maxLength={160} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("manufacturer")} error={e("manufacturer")}>
          <Input name="manufacturer" required maxLength={160} />
        </Field>
        <Field label={t("form")} error={e("form")}>
          <Select name="form" defaultValue="tablet">
            {DOSAGE_FORMS.map((f) => (
              <option key={f} value={f}>
                {te(`dosageForm.${f}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("packSizeLabel")} error={e("packSizeLabel")}>
          <Input name="packSizeLabel" required maxLength={80} />
        </Field>
        <Field label={t("mrp")} error={e("mrp")}>
          <Input name="mrp" inputMode="decimal" required />
        </Field>
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem] gap-2">
            <Input name={`salt${i}`} placeholder={`${t("salt")} ${i + 1}`} aria-label={`${t("salt")} ${i + 1}`} />
            <Input name={`strength${i}`} placeholder={t("strength")} aria-label={t("strength")} />
          </div>
        ))}
        {e("ingredients") ? <p className="text-xs text-red-600">{e("ingredients")}</p> : null}
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? te("common.saving") : t("createProduct")}
      </Button>
    </form>
  );
}
