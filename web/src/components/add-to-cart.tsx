"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { addToCart } from "@/app/app/cart/actions";
import { Button, cn } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";

export function AddToCart({
  listingId,
  minOrderQty,
  stock,
  compact,
}: {
  listingId: string;
  minOrderQty: number;
  stock: number;
  compact?: boolean;
}) {
  const t = useTranslations("cart");
  const err = useErrorText();
  const [qty, setQty] = useState(String(minOrderQty));
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string>();

  const n = Number(qty);
  const valid = Number.isInteger(n) && n >= minOrderQty && n <= stock;

  return (
    <div className={cn("flex flex-col gap-1", compact ? "items-end" : "")}>
      <div className="flex items-center gap-2">
        <input
          aria-label={t("qty")}
          inputMode="numeric"
          value={qty}
          onChange={(e) => {
            setQty(e.target.value.replace(/\D/g, ""));
            setAdded(false);
          }}
          className="h-9 w-16 rounded-md border border-line bg-white px-2 text-right text-base tabular-nums sm:text-sm"
        />
        <Button
          variant={added ? "secondary" : "primary"}
          className={cn("h-9 px-3", compact ? "" : "flex-1")}
          disabled={!valid || pending}
          onClick={() =>
            start(async () => {
              setError(undefined);
              const r = await addToCart(listingId, n);
              if (r.error) setError(err(r.error));
              else setAdded(true);
            })
          }
        >
          {pending ? t("adding") : added ? `✓ ${t("added")}` : t("addToCart")}
        </Button>
      </div>
      {added ? (
        <Link href="/app/cart" className="text-xs text-brand-700 hover:underline">
          {t("viewCart")} →
        </Link>
      ) : !valid && qty ? (
        <span className="text-xs text-red-600">
          {n < minOrderQty ? t("minQty", { count: minOrderQty }) : t("insufficientStock", { count: stock })}
        </span>
      ) : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
