"use client";

import { buttonClass } from "@/components/ui";

/** The receipt is printed from the browser — no PDF service to pay for. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      {label}
    </button>
  );
}
