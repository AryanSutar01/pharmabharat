"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, cn } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { MAX_LISTING_FILES, type ListingFileKind } from "@/lib/catalog/constants";
import { getListingUploadSignature } from "./actions";

export type ListingFileItem = {
  kind: ListingFileKind;
  publicId: string;
  /** Signed preview (existing file) or a local object URL (just uploaded). */
  preview: string | null;
  isPdf: boolean;
};

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Photos of the actual box/batch, the purchase invoice and other proof.
 * Files upload straight to Cloudinary; the form submits only their ids
 * (hidden input "files"), which the server verifies.
 */
export function ListingFiles({ initial, error }: { initial: ListingFileItem[]; error?: string }) {
  const t = useTranslations("inventory");
  const err = useErrorText();
  const [files, setFiles] = useState<ListingFileItem[]>(initial);
  const [busy, setBusy] = useState<ListingFileKind | null>(null);
  const [localError, setLocalError] = useState<string>();
  const inputs = useRef<Partial<Record<ListingFileKind, HTMLInputElement | null>>>({});
  const full = files.length >= MAX_LISTING_FILES;
  const hasBox = files.some((f) => f.kind === "box");

  async function upload(kind: ListingFileKind, file: File) {
    setLocalError(undefined);
    const isPdf = file.type === "application/pdf";
    if (file.size > MAX_BYTES) return setLocalError(err("file_too_large"));
    if (!IMAGE_TYPES.includes(file.type) && !(kind === "invoice" && isPdf)) return setLocalError(err("file_type"));
    if (full) return setLocalError(err("too_many_files"));
    setBusy(kind);
    try {
      const sig = await getListingUploadSignature();
      const body = new FormData();
      body.set("file", file);
      body.set("api_key", sig.apiKey);
      body.set("timestamp", String(sig.timestamp));
      body.set("signature", sig.signature);
      body.set("folder", sig.folder);
      body.set("type", sig.type);
      body.set("allowed_formats", sig.allowed_formats);
      const res = await fetch(sig.uploadUrl, { method: "POST", body });
      if (!res.ok) throw new Error("upload_failed");
      const json = (await res.json()) as { public_id: string };
      setFiles((list) => [...list, { kind, publicId: json.public_id, preview: isPdf ? null : URL.createObjectURL(file), isPdf }]);
    } catch {
      setLocalError(err("upload_failed"));
    } finally {
      setBusy(null);
      const input = inputs.current[kind];
      if (input) input.value = "";
    }
  }

  const kinds: { kind: ListingFileKind; label: string; accept: string }[] = [
    { kind: "box", label: t("fileBox"), accept: IMAGE_TYPES.join(",") },
    { kind: "invoice", label: t("fileInvoice"), accept: [...IMAGE_TYPES, "application/pdf"].join(",") },
    { kind: "other", label: t("fileOther"), accept: IMAGE_TYPES.join(",") },
  ];

  return (
    <div className="space-y-4">
      <input type="hidden" name="files" value={JSON.stringify(files.map(({ kind, publicId }) => ({ kind, publicId })))} />

      <div className="flex flex-wrap items-center gap-2">
        {kinds.map((k) => (
          <label
            key={k.kind}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
              full || busy ? "cursor-not-allowed border-line text-muted opacity-60" : "border-line bg-white hover:bg-canvas",
              k.kind === "box" && !hasBox && "border-brand-600 text-brand-800",
            )}
          >
            <input
              ref={(el) => {
                inputs.current[k.kind] = el;
              }}
              type="file"
              accept={k.accept}
              className="sr-only"
              disabled={full || busy !== null}
              onChange={(e) => e.target.files?.[0] && upload(k.kind, e.target.files[0])}
            />
            <span aria-hidden>{busy === k.kind ? "…" : "+"}</span>
            {k.label}
            {k.kind === "box" ? <span className="text-xs font-normal text-muted">({t("required")})</span> : null}
          </label>
        ))}
        <span className="ml-auto text-xs tabular-nums text-muted">
          {files.length} / {MAX_LISTING_FILES}
        </span>
      </div>

      {files.length ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {files.map((f) => (
            <li key={f.publicId} className="group relative overflow-hidden rounded-lg border border-line bg-canvas">
              <div className="aspect-square">
                {f.preview ? (
                  // Signed Cloudinary URL or a local blob: next/image can't optimise either.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-xs font-semibold text-muted">PDF</div>
                )}
              </div>
              <div className="absolute left-1.5 top-1.5">
                <Badge tone={f.kind === "invoice" ? "warning" : f.kind === "box" ? "success" : "neutral"}>
                  {t(`fileKind.${f.kind}`)}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => setFiles((list) => list.filter((x) => x.publicId !== f.publicId))}
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-sm text-red-600 shadow hover:bg-white"
                aria-label={t("removeFile")}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-muted">{t("filesHint")}</p>
      {localError || error ? <p className="text-xs text-red-600">{localError ?? error}</p> : null}
    </div>
  );
}
