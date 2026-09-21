"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { STATES } from "@/lib/india";
import type { BusinessType } from "@/lib/permissions";
import { LICENSE_FORMS } from "@/lib/validation/business";
import { saveBusinessProfile, type FormState } from "./actions";

export type ProfileDefaults = {
  legalName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
  address: { line1: string; line2: string; city: string; district: string; stateCode: string; pincode: string };
  drugLicenses: { form: string; number: string; validTill: string }[];
  pharmacist: { name: string; registrationNumber: string };
  fssaiNumber: string;
};

export function ProfileForm({ type, defaults: saved }: { type: BusinessType; defaults: ProfileDefaults }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const err = useErrorText();
  const [state, action, pending] = useActionState<FormState, FormData>(saveBusinessProfile, {});
  const defaults = state.values ?? saved;
  const [licenseRows, setLicenseRows] = useState(Math.max(1, saved.drugLicenses.length));
  const e = (k: string) => err(state.errors?.[k]);

  return (
    <form action={action} className="space-y-6" noValidate>
      {state.ok ? <Alert tone="success" title={tc("saved")} /> : null}
      {state.message ? <Alert tone="danger" title={err(state.message)} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("legalName")} error={e("legalName")}>
          <Input name="legalName" defaultValue={defaults.legalName} required />
        </Field>
        <Field label={<>{t("tradeName")} <span className="font-normal text-muted">({tc("optional")})</span></>} error={e("tradeName")}>
          <Input name="tradeName" defaultValue={defaults.tradeName} />
        </Field>
        <Field label={t("gstin")} error={e("gstin")}>
          <Input
            name="gstin"
            defaultValue={defaults.gstin}
            maxLength={15}
            className="font-mono uppercase"
            autoCapitalize="characters"
            placeholder="27ABCDE1234F1Z5"
            required
          />
        </Field>
        <Field label={t("pan")} error={e("pan")}>
          <Input
            name="pan"
            defaultValue={defaults.pan}
            maxLength={10}
            className="font-mono uppercase"
            autoCapitalize="characters"
            placeholder="ABCDE1234F"
            required
          />
        </Field>
        <Field label={t("phone")} error={e("phone")}>
          <Input name="phone" type="tel" inputMode="numeric" defaultValue={defaults.phone} maxLength={13} required />
        </Field>
        <Field label={t("email")} error={e("email")}>
          <Input name="email" type="email" defaultValue={defaults.email} required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("addressLine1")} error={e("address.line1")} className="sm:col-span-2">
          <Input name="address.line1" defaultValue={defaults.address.line1} autoComplete="address-line1" required />
        </Field>
        <Field
          label={<>{t("addressLine2")} <span className="font-normal text-muted">({tc("optional")})</span></>}
          className="sm:col-span-2"
        >
          <Input name="address.line2" defaultValue={defaults.address.line2} autoComplete="address-line2" />
        </Field>
        <Field label={t("city")} error={e("address.city")}>
          <Input name="address.city" defaultValue={defaults.address.city} autoComplete="address-level2" required />
        </Field>
        <Field label={<>{t("district")} <span className="font-normal text-muted">({tc("optional")})</span></>}>
          <Input name="address.district" defaultValue={defaults.address.district} />
        </Field>
        <Field label={t("state")} error={e("address.stateCode")}>
          <Select name="address.stateCode" defaultValue={defaults.address.stateCode} required>
            <option value="">{t("selectState")}</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("pincode")} error={e("address.pincode")}>
          <Input
            name="address.pincode"
            inputMode="numeric"
            maxLength={6}
            defaultValue={defaults.address.pincode}
            autoComplete="postal-code"
            required
          />
        </Field>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">{t("licensesTitle")}</h3>
          <p className="text-sm text-muted">{t("licensesHelp")}</p>
          {e("drugLicenses") ? <p className="mt-1 text-xs text-red-600">{e("drugLicenses")}</p> : null}
        </div>
        {Array.from({ length: licenseRows }, (_, i) => {
          const d = defaults.drugLicenses[i];
          return (
            <div key={i} className="grid grid-cols-[6rem_1fr] gap-3 rounded-lg border border-line p-3 sm:grid-cols-[7rem_1fr_11rem]">
              <Field label={t("licenseForm")} error={e(`drugLicenses.${i}.form`)}>
                <Select name={`drugLicenses.${i}.form`} defaultValue={d?.form ?? ""}>
                  <option value="">—</option>
                  {LICENSE_FORMS[type].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("licenseNumber")} error={e(`drugLicenses.${i}.number`)}>
                <Input name={`drugLicenses.${i}.number`} defaultValue={d?.number ?? ""} className="uppercase" />
              </Field>
              <Field label={t("licenseValidTill")} error={e(`drugLicenses.${i}.validTill`)} className="col-span-2 sm:col-span-1">
                <Input name={`drugLicenses.${i}.validTill`} type="date" defaultValue={d?.validTill ?? ""} />
              </Field>
            </div>
          );
        })}
        {licenseRows < 4 ? (
          <Button type="button" variant="secondary" onClick={() => setLicenseRows((n) => n + 1)}>
            + {t("addLicense")}
          </Button>
        ) : null}
      </section>

      {type === "retailer" ? (
        <section className="space-y-3">
          <h3 className="font-semibold">{t("pharmacistTitle")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("pharmacistName")} error={e("pharmacist.name")}>
              <Input name="pharmacist.name" defaultValue={defaults.pharmacist.name} />
            </Field>
            <Field label={t("pharmacistReg")} error={e("pharmacist.registrationNumber")}>
              <Input name="pharmacist.registrationNumber" defaultValue={defaults.pharmacist.registrationNumber} className="uppercase" />
            </Field>
          </div>
        </section>
      ) : null}

      <Field
        label={<>{t("fssai")} <span className="font-normal text-muted">({tc("optional")})</span></>}
        error={e("fssaiNumber")}
        className="sm:max-w-xs"
      >
        <Input name="fssaiNumber" inputMode="numeric" maxLength={14} defaultValue={defaults.fssaiNumber} />
      </Field>

      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? tc("saving") : t("saveDetails")}
        </Button>
      </div>
    </form>
  );
}
