"use client";

import { useState } from "react";
import { cn } from "@/components/ui";

export type DocPreview = {
  id: string;
  label: string;
  sublabel?: string;
  /** Signed preview image (PDFs show their first page). */
  thumb: string | null;
  /** Opens the full file (signed URL or the protected download route). */
  href: string;
  tone?: "warning" | "default";
};

/**
 * Thumbnail grid for private documents (KYC files, listing photos/invoices),
 * so reviewers can cross-check at a glance and open any file full-size.
 */
export function DocPreviewGrid({ items, openLabel, size = "md" }: { items: DocPreview[]; openLabel: string; size?: "sm" | "md" }) {
  return (
    <ul className={cn("grid gap-3", size === "sm" ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-3")}>
      {items.map((d) => (
        <li key={d.id}>
          <a
            href={d.href}
            target="_blank"
            rel="noopener"
            className="group block overflow-hidden rounded-lg border border-line bg-white transition-colors hover:border-brand-500"
            aria-label={`${openLabel}: ${d.label}`}
          >
            <Thumb src={d.thumb} className={size === "sm" ? "aspect-square" : "aspect-[4/3]"} />
            {size === "md" ? (
              <div className={cn("border-t border-line px-2.5 py-2", d.tone === "warning" && "bg-amber-50")}>
                <p className="truncate text-xs font-medium">{d.label}</p>
                {d.sublabel ? <p className="truncate text-[11px] text-muted">{d.sublabel}</p> : null}
              </div>
            ) : (
              <p className={cn("truncate px-1.5 py-1 text-[10px] text-muted", d.tone === "warning" && "bg-amber-50 text-amber-900")}>{d.label}</p>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Thumb({ src, className }: { src: string | null; className: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("grid place-items-center overflow-hidden bg-canvas", className)}>
      {src && !failed ? (
        // Signed Cloudinary preview; next/image would re-proxy an already-optimised URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="size-full object-cover transition-transform group-hover:scale-[1.02]" />
      ) : (
        <span className="text-xs font-semibold text-muted">📄</span>
      )}
    </div>
  );
}
