"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { ASSIGNABLE_ROLES, type MemberRole } from "@/lib/permissions";
import { changeMemberRole, inviteMember, revokeInvite, setMemberStatus, type TeamFormState } from "./actions";

export function InviteForm() {
  const t = useTranslations();
  const err = useErrorText();
  const [state, action, pending] = useActionState<TeamFormState, FormData>(inviteMember, {});

  return (
    <form action={action} className="space-y-4">
      {state.ok ? <Alert tone="success" title={t("team.inviteSent", { email: state.email ?? "" })} /> : null}
      {state.error ? <Alert tone="danger" title={err(state.error)} /> : null}
      <Field label={t("team.email")}>
        <Input name="email" type="email" required autoComplete="off" />
      </Field>
      <Field label={t("team.role")}>
        <Select name="role" defaultValue="manager">
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </Select>
      </Field>
      <ul className="space-y-1 text-xs text-muted">
        {ASSIGNABLE_ROLES.map((r) => (
          <li key={r}>
            <b className="text-ink">{t(`role.${r}`)}:</b> {t(`roleHelp.${r}`)}
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("common.saving") : t("team.sendInvite")}
      </Button>
    </form>
  );
}

export function MemberControls({ id, role, status }: { id: string; role: MemberRole; status: "active" | "disabled" }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label={t("team.role")}
        value={role}
        disabled={pending}
        onChange={(e) => start(async () => void (await changeMemberRole(id, e.target.value)))}
        className="h-9 w-36"
      >
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`role.${r}`)}
          </option>
        ))}
      </Select>
      <Button
        variant="ghost"
        className="h-9 px-3"
        disabled={pending}
        onClick={() => start(() => setMemberStatus(id, status === "active" ? "disabled" : "active"))}
      >
        {status === "active" ? t("team.disable") : t("team.enable")}
      </Button>
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const t = useTranslations("team");
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" className="h-9 px-3 text-red-600" disabled={pending} onClick={() => start(() => revokeInvite(id))}>
      {t("revoke")}
    </Button>
  );
}
