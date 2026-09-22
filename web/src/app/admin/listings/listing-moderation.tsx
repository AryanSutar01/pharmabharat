"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { holdListing, releaseListing } from "../actions";

export function ListingModeration({ id, held }: { id: string; held: boolean }) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  return held ? (
    <Button variant="secondary" className="h-9 px-3" disabled={pending} onClick={() => start(async () => void (await releaseListing(id)))}>
      {t("release")}
    </Button>
  ) : (
    <Button
      variant="ghost"
      className="h-9 px-3 text-red-600"
      disabled={pending}
      onClick={() => {
        const reason = prompt(t("holdReason"));
        if (reason?.trim()) start(async () => void (await holdListing(id, reason)));
      }}
    >
      {t("hold")}
    </Button>
  );
}
