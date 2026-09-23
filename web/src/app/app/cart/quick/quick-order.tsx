"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Alert, Badge, Button, Card, CardHeader, Input, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import type { MatchedLine } from "@/lib/orders/reorder";
import { addLinesToCart, previewList, type QuickState } from "./actions";

const TONE = { ok: "success", adjusted: "warning", no_offer: "danger", no_product: "danger" } as const;

export function QuickOrder({ initialLines, sourceLabel }: { initialLines?: MatchedLine[]; sourceLabel?: string }) {
  const t = useTranslations("cart");
  const err = useErrorText();
  const format = useFormatter();
  const [preview, previewAction, previewing] = useActionState<QuickState, FormData>(previewList, {});
  const [addState, addAction, adding] = useActionState<QuickState, FormData>(addLinesToCart, {});
  const [rows, setRows] = useState<MatchedLine[]>(initialLines ?? []);

  // A new match result replaces whatever was on screen (adjust state during render).
  const [shown, setShown] = useState(preview.lines);
  if (preview.lines !== shown) {
    setShown(preview.lines);
    if (preview.lines) setRows(preview.lines);
  }

  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const buyable = rows.filter((r) => r.offer);
  const total = buyable.reduce((a, r) => a + r.offer!.price * r.qty, 0);
  const payload = JSON.stringify(buyable.map((r) => ({ listingId: r.offer!.listingId, qty: r.qty })));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t("quickPaste")} description={t("quickPasteHint")} />
        <form action={previewAction} className="space-y-3 p-4 sm:p-5">
          <Textarea
            name="text"
            rows={8}
            defaultValue={preview.text}
            placeholder={"Dolo 650 Tablet, 10\nAzithral 500 Tablet, 5\nPan D Capsule x 3"}
            className="font-mono text-sm"
          />
          {preview.error ? <Alert tone="danger" title={err(preview.error)} /> : null}
          <Button type="submit" disabled={previewing}>
            {previewing ? t("quickMatching") : t("quickMatch")}
          </Button>
        </form>
      </Card>

      {rows.length ? (
        <Card>
          <CardHeader
            title={t("quickResult", { count: rows.length })}
            description={sourceLabel ?? t("quickResultHint")}
          />
          {addState.added ? (
            <div className="px-4 pt-4 sm:px-5">
              <Alert tone="success" title={t("quickAdded", { count: addState.added, skipped: addState.skipped ?? 0 })}>
                <Link href="/app/cart" className="font-medium underline">
                  {t("title")} →
                </Link>
              </Alert>
            </div>
          ) : null}
          {addState.error ? (
            <div className="px-4 pt-4 sm:px-5">
              <Alert tone="danger" title={err(addState.error)} />
            </div>
          ) : null}

          <ul className="divide-y divide-line">
            {rows.map((r, i) => (
              <li key={`${r.query}-${i}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {r.product ? (
                      <Link href={`/app/catalog/${r.product.id}`} className="hover:underline">
                        {r.product.name}
                      </Link>
                    ) : (
                      r.query
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {r.offer
                      ? `${r.offer.sellerName} · ${inr(r.offer.price)} · ${t("quickStock", { count: r.offer.stock })}`
                      : t(`quickStatus.${r.status}`)}
                    {r.product && r.raw !== r.product.name ? ` · ${t("quickMatchedFrom", { text: r.raw })}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={TONE[r.status]}>{t(`quickStatus.${r.status}`)}</Badge>
                  {r.offer ? (
                    <>
                      <Input
                        type="number"
                        min={r.offer.minOrderQty}
                        max={r.offer.stock}
                        value={r.qty}
                        aria-label={t("qty")}
                        className="w-20"
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((row, j) => (j === i ? { ...row, qty: Math.max(Number(e.target.value) || 0, 0) } : row)),
                          )
                        }
                      />
                      <span className="w-24 shrink-0 text-right font-medium tabular-nums">{inr(r.offer.price * r.qty)}</span>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <form action={addAction} className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4 sm:p-5">
            <input type="hidden" name="lines" value={payload} />
            <p className="text-sm text-muted">
              {t("quickTotal", { count: buyable.length })} <b className="text-ink tabular-nums">{inr(total)}</b>
            </p>
            <Button type="submit" disabled={adding || !buyable.length}>
              {adding ? t("quickAdding") : t("quickAddAll")}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
