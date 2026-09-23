"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveReorderLevel } from "./actions";

/** Inline editor for a medicine's minimum, next to the computed one. */
export function ReorderLevel({ productId, level }: { productId: string; level: number }) {
  const t = useTranslations("shop");
  const [value, setValue] = useState(String(level));
  const [pending, start] = useTransition();

  return (
    <label className="text-right text-xs text-muted">
      {t("reorderLevel")}
      <input
        aria-label={t("reorderLevel")}
        inputMode="numeric"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        onBlur={() => {
          const n = Number(value);
          if (Number.isInteger(n) && n >= 0 && n !== level) start(async () => void (await saveReorderLevel(productId, n)));
          else setValue(String(level));
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="mt-1 block h-9 w-16 rounded-md border border-line bg-white px-2 text-right text-base tabular-nums sm:text-sm"
      />
    </label>
  );
}
