// Plain constants shared by models, validation and client components
// (kept out of the mongoose model files so client bundles don't pull mongoose).

export const STORAGE_CONDITIONS = ["room", "cool", "cold_chain", "frozen", "protect_light"] as const;
export type StorageCondition = (typeof STORAGE_CONDITIONS)[number];

export const DRUG_SCHEDULES = ["otc", "h", "h1", "x", "g"] as const;
export type DrugSchedule = (typeof DRUG_SCHEDULES)[number];

export const GST_RATES = [0, 5, 12, 18, 28] as const;
