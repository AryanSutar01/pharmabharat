// Drug-licence validity rules (no I/O) — unit tested in tests/licence.test.ts.

/** Days before expiry at which we warn the business. */
export const LICENCE_WARN_LEVELS = [60, 30, 7] as const;
export type LicenceWarnLevel = (typeof LICENCE_WARN_LEVELS)[number];

const DAY = 24 * 3600 * 1000;

export type LicenceLike = { form: string; number: string; validTill: Date | string };

/** The licence that runs out first — that is what limits the business. */
export function earliestLicence<T extends LicenceLike>(licences: T[]): T | null {
  return [...licences].sort((a, b) => new Date(a.validTill).getTime() - new Date(b.validTill).getTime())[0] ?? null;
}

/** Whole days until a date; negative once it has passed. */
export function daysUntil(date: Date | string, now = new Date()) {
  return Math.ceil((new Date(date).getTime() - now.getTime()) / DAY);
}

export type LicenceStatus = "ok" | "expiring" | "expired" | "missing";

export function licenceStatus(licences: LicenceLike[], now = new Date()): { status: LicenceStatus; daysLeft: number; licence: LicenceLike | null } {
  const licence = earliestLicence(licences);
  if (!licence) return { status: "missing", daysLeft: 0, licence: null };
  const daysLeft = daysUntil(licence.validTill, now);
  return { status: daysLeft <= 0 ? "expired" : daysLeft <= LICENCE_WARN_LEVELS[0] ? "expiring" : "ok", daysLeft, licence };
}

/**
 * The warning to send today, or null. Levels only ever go down, so a business
 * gets at most one email per level however often the job runs.
 */
export function dueLicenceWarning(daysLeft: number, lastLevel: number | null | undefined): LicenceWarnLevel | null {
  if (daysLeft <= 0) return null; // expiry is handled as a suspension, not a warning
  // Tightest level that still covers today (7 before 30 before 60).
  const level = [...LICENCE_WARN_LEVELS].reverse().find((l) => daysLeft <= l);
  if (!level) return null;
  if (lastLevel != null && level >= lastLevel) return null;
  return level;
}
