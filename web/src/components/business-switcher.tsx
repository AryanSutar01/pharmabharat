"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { switchBusiness } from "@/app/onboarding/actions";

/**
 * Sidebar business block: the business name once, and — if the user belongs
 * to several businesses — that name is itself the switcher.
 */
export function BusinessSwitcher({
  current,
  options,
  subtitle,
}: {
  current: string;
  options: { id: string; name: string; type: string }[];
  subtitle: string;
}) {
  const t = useTranslations("nav");
  const [pending, start] = useTransition();
  const name = options.find((o) => o.id === current)?.name ?? "";

  return (
    <div>
      {options.length > 1 ? (
        <label className="relative block">
          <span className="sr-only">{t("switchBusiness")}</span>
          <select
            value={current}
            disabled={pending}
            onChange={(e) => start(() => switchBusiness(e.target.value))}
            className="w-full cursor-pointer appearance-none truncate rounded-lg bg-transparent py-1 pr-6 text-sm font-semibold text-ink hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-muted" aria-hidden>
            ▾
          </span>
        </label>
      ) : (
        <p className="truncate py-1 text-sm font-semibold">{name}</p>
      )}
      <p className="text-xs text-muted">{subtitle}</p>
      <Link href="/onboarding/new" className="mt-1 inline-block text-xs text-brand-700 hover:underline">
        + {t("addBusiness")}
      </Link>
    </div>
  );
}
