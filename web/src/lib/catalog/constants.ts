// Plain constants shared by models, validation and client components
// (kept out of the mongoose model files so client bundles don't pull mongoose).

export const STORAGE_CONDITIONS = ["room", "cool", "cold_chain", "frozen", "protect_light"] as const;
export type StorageCondition = (typeof STORAGE_CONDITIONS)[number];

export const DRUG_SCHEDULES = ["otc", "h", "h1", "x", "g"] as const;
export type DrugSchedule = (typeof DRUG_SCHEDULES)[number];

export const GST_RATES = [0, 5, 12, 18, 28] as const;

/** Files a seller attaches to a listing (max MAX_LISTING_FILES in total). */
export const LISTING_FILE_KINDS = ["box", "invoice", "other"] as const;
export type ListingFileKind = (typeof LISTING_FILE_KINDS)[number];
export const MAX_LISTING_FILES = 5;
/** Kinds buyers may see. Purchase invoices reveal the seller's cost: seller + admin only. */
export const PUBLIC_LISTING_FILE_KINDS: ListingFileKind[] = ["box", "other"];

