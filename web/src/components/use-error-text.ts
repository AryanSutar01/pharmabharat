"use client";

import { useTranslations } from "next-intl";

/** Maps error codes returned by server actions to translated text. */
export function useErrorText() {
  const t = useTranslations("errors");
  return (code?: string) => {
    if (!code) return undefined;
    return t.has(code) ? t(code) : t("invalid");
  };
}
