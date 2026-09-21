"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { switchBusiness } from "@/app/onboarding/actions";

export function BusinessSwitcher({
  current,
  options,
}: {
  current: string;
  options: { id: string; name: string; type: string }[];
}) {
  const t = useTranslations("nav");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-1">
      {options.length > 1 ? (
        <select
          aria-label={t("switchBusiness")}
          value={current}
          disabled={pending}
          onChange={(e) => start(() => switchBusiness(e.target.value))}
          className="w-full truncate rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      ) : null}
      <Link href="/onboarding/new" className="block px-1 text-xs text-brand-700 hover:underline">
        + {t("addBusiness")}
      </Link>
    </div>
  );
}
