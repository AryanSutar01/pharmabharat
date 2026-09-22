"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { deletePriceAlert } from "./actions";

export function RemoveAlertButton({ id }: { id: string }) {
  const t = useTranslations("alerts");
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" className="h-8 px-2 text-xs text-red-600" disabled={pending} onClick={() => start(() => deletePriceAlert(id))}>
      {t("remove")}
    </Button>
  );
}
