"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, buttonClass } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import type { DocumentKind } from "@/lib/models/business";
import { attachDocument, getKycUploadSignature, removeDocument, submitForReview } from "./actions";

export type UploadedDoc = { id: string; kind: DocumentKind; name: string };

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export function Documents({
  businessId,
  required,
  optional,
  docs,
  editable,
  configured,
}: {
  businessId: string;
  required: DocumentKind[];
  optional: DocumentKind[];
  docs: UploadedDoc[];
  editable: boolean;
  configured: boolean;
}) {
  const t = useTranslations();
  const kinds = [...required, ...optional];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t("onboarding.documentsHelp")}</p>
      {!configured && editable ? <p className="text-sm text-amber-700">{t("onboarding.notConfigured")}</p> : null}
      <ul className="divide-y divide-line rounded-lg border border-line">
        {kinds.map((kind) => (
          <DocumentRow
            key={kind}
            kind={kind}
            businessId={businessId}
            isRequired={required.includes(kind)}
            docs={docs.filter((d) => d.kind === kind)}
            editable={editable && configured}
          />
        ))}
      </ul>
    </div>
  );
}

function DocumentRow({
  kind,
  businessId,
  isRequired,
  docs,
  editable,
}: {
  kind: DocumentKind;
  businessId: string;
  isRequired: boolean;
  docs: UploadedDoc[];
  editable: boolean;
}) {
  const t = useTranslations();
  const err = useErrorText();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [, startRemove] = useTransition();

  async function upload(file: File) {
    setError(undefined);
    if (file.size > MAX_BYTES) return setError(err("file_too_large"));
    if (!ACCEPT.split(",").includes(file.type)) return setError(err("file_type"));
    setBusy(true);
    try {
      const sig = await getKycUploadSignature();
      const body = new FormData();
      body.set("file", file);
      body.set("api_key", sig.apiKey);
      body.set("timestamp", String(sig.timestamp));
      body.set("signature", sig.signature);
      body.set("folder", sig.folder);
      body.set("type", sig.type);
      body.set("allowed_formats", sig.allowed_formats);
      const res = await fetch(sig.uploadUrl, { method: "POST", body });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { public_id: string };
      const result = await attachDocument({ kind, publicId: json.public_id, originalName: file.name.slice(0, 200) });
      if (result.message) throw new Error(result.message);
      router.refresh();
    } catch (e) {
      console.error(e);
      setError(err(e instanceof Error && e.message.length < 40 ? e.message : "upload_failed"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t(`documentKind.${kind}`)}</span>
          {isRequired ? (
            <Badge tone={docs.length ? "success" : "warning"}>{docs.length ? "✓" : t("onboarding.required")}</Badge>
          ) : null}
        </div>
        {docs.map((d) => (
          <div key={d.id} className="mt-1 flex items-center gap-3 text-sm">
            <a
              href={`/api/kyc-documents/${businessId}/${d.id}`}
              target="_blank"
              rel="noopener"
              className="truncate text-brand-700 underline underline-offset-2"
            >
              {d.name}
            </a>
            {editable ? (
              <button
                type="button"
                className="shrink-0 text-xs text-red-600 hover:underline"
                onClick={() =>
                  startRemove(async () => {
                    await removeDocument(d.id);
                    router.refresh();
                  })
                }
              >
                {t("common.remove")}
              </button>
            ) : null}
          </div>
        ))}
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
      {editable ? (
        <div className="shrink-0">
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            id={`file-${kind}`}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            disabled={busy}
          />
          <label htmlFor={`file-${kind}`} className={buttonClass("secondary", "h-9 cursor-pointer px-3")}>
            {busy ? t("onboarding.uploading") : docs.length ? t("onboarding.uploadAnother") : t("onboarding.upload")}
          </label>
        </div>
      ) : null}
    </li>
  );
}

export function SubmitForReview({ disabled }: { disabled: boolean }) {
  const t = useTranslations("onboarding");
  const err = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="space-y-2">
      <Button
        disabled={disabled || pending}
        className="w-full sm:w-auto"
        onClick={() =>
          start(async () => {
            const r = await submitForReview();
            if (r.message) setError(err(r.message));
            else router.refresh();
          })
        }
      >
        {t("submitCta")}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
