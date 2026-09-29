// A business's GST position. Client-safe (no database imports) because the
// onboarding form and the billing counter both need it.
//
// Three real cases in India:
//
//   registered    holds a GSTIN, charges GST, issues a Tax Invoice.
//   composition   holds a GSTIN under the composition scheme. Pays a flat rate
//                 out of its own pocket and **must not** collect GST from the
//                 customer, so it issues a Bill of Supply carrying the
//                 declaration below.
//   unregistered  turnover is under the registration threshold, so there is no
//                 GSTIN at all. Cannot collect GST; issues a Bill of Supply.
//
// A drug licence is required in every case — that is a different law.

export const TAX_STATUSES = ["registered", "composition", "unregistered"] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];

/** May this business charge GST on what it sells? */
export const collectsGst = (status?: TaxStatus | string | null) => (status ?? "registered") === "registered";

/** Does it hold a GSTIN at all? Composition dealers are registered, just not collecting. */
export const needsGstin = (status?: TaxStatus | string | null) => (status ?? "registered") !== "unregistered";

/** What the law lets this business head its sales document with. */
export const documentTypeFor = (status?: TaxStatus | string | null) =>
  collectsGst(status) ? ("tax_invoice" as const) : ("bill_of_supply" as const);
export type SalesDocumentType = ReturnType<typeof documentTypeFor>;

/**
 * Wording a composition dealer must carry at the top of every bill of supply
 * (CGST Rules). Kept here so the receipt and the PDF cannot drift apart.
 */
export const COMPOSITION_DECLARATION =
  "Composition taxable person, not eligible to collect tax on supplies";
