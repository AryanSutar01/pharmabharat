"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createSupportTicket, type SupportFormState } from "@/app/app/support/actions";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { CALLBACK_SLOTS, TICKET_CATEGORIES, TICKET_PRIORITIES, type TicketKind } from "@/lib/support/constants";

/** New ticket or call-back request. Used in /app/support/new and on /help. */
export function TicketForm({ kind, defaultPhone = "" }: { kind: TicketKind; defaultPhone?: string }) {
  const t = useTranslations("support");
  const locale = useLocale();
  const err = useErrorText();
  const [state, action, pending] = useActionState<SupportFormState, FormData>(createSupportTicket, {});
  const e = (k: string) => err(state.errors?.[k]);

  if (state.ok) return <Alert tone="success" title={t("submitted")} />;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="kind" value={kind} />
      <Field label={t("category")} error={e("category")}>
        <Select name="category" defaultValue={kind === "callback" ? "kyc" : ""} required>
          <option value="">—</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categoryLabel.${c}`)}
            </option>
          ))}
        </Select>
      </Field>

      {kind === "ticket" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label={t("subject")} error={e("subject")}>
              <Input name="subject" maxLength={150} required />
            </Field>
            <Field label={t("priority")}>
              <Select name="priority" defaultValue="normal">
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`priorityLabel.${p}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t("orderNo")} error={e("orderNo")}>
            <Input name="orderNo" placeholder="PB-2609-000123" className="uppercase sm:max-w-xs" />
          </Field>
          <Field label={t("message")} error={e("message")}>
            <Textarea name="message" rows={6} maxLength={5000} required />
          </Field>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">{t("callbackHelp")}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("phone")} error={e("phone")}>
              <Input name="phone" type="tel" inputMode="numeric" defaultValue={defaultPhone} required />
            </Field>
            <Field label={t("slot")} error={e("slot")}>
              <Select name="slot" defaultValue="morning">
                {CALLBACK_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`slotLabel.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("language")}>
              <Select name="language" defaultValue={locale}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="mr">मराठी</option>
              </Select>
            </Field>
          </div>
          <Field label={t("messageOptional")} error={e("message")}>
            <Textarea name="message" rows={3} maxLength={1000} />
          </Field>
        </>
      )}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "…" : t("submit")}
      </Button>
    </form>
  );
}
