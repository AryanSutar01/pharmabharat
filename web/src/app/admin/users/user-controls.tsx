"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button, Select } from "@/components/ui";
import { setUserBanned, setUserRole } from "../actions";

const ROLES = ["user", "support", "admin"] as const;

export function UserControls({ id, role, banned }: { id: string; role: string; banned: boolean }) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label={t("role")}
        value={role}
        disabled={pending}
        onChange={(e) => start(async () => void (await setUserRole(id, e.target.value)))}
        className="h-9 w-40"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`platformRole.${r}`)}
          </option>
        ))}
      </Select>
      <Button
        variant={banned ? "secondary" : "ghost"}
        className={banned ? "h-9 px-3" : "h-9 px-3 text-red-600"}
        disabled={pending}
        onClick={() => {
          if (!banned && !confirm(t("confirmBan"))) return;
          start(async () => void (await setUserBanned(id, !banned)));
        }}
      >
        {banned ? t("unban") : t("ban")}
      </Button>
    </div>
  );
}
