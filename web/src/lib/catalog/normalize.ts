// Pure helpers shared by the app and scripts/import-medicines.ts.
// Keep this file free of "@/" imports so Node can run the script directly.

export const DOSAGE_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "suspension",
  "injection",
  "infusion",
  "drops",
  "cream",
  "ointment",
  "gel",
  "lotion",
  "solution",
  "spray",
  "inhaler",
  "powder",
  "sachet",
  "soap",
  "shampoo",
  "other",
] as const;
export type DosageForm = (typeof DOSAGE_FORMS)[number];

/** Words in a brand name that reveal the dosage form. Checked from the end of the name. */
const FORM_WORDS: Record<string, DosageForm> = {
  tablet: "tablet",
  tablets: "tablet",
  tab: "tablet",
  sr: "tablet",
  dt: "tablet",
  er: "tablet",
  md: "tablet",
  pr: "tablet",
  cr: "tablet",
  xl: "tablet",
  mr: "tablet",
  od: "tablet",
  capsule: "capsule",
  capsules: "capsule",
  cap: "capsule",
  syrup: "syrup",
  expectorant: "syrup",
  linctus: "syrup",
  suspension: "suspension",
  injection: "injection",
  infusion: "infusion",
  drop: "drops",
  drops: "drops",
  cream: "cream",
  ointment: "ointment",
  gel: "gel",
  lotion: "lotion",
  solution: "solution",
  spray: "spray",
  inhaler: "inhaler",
  rotacap: "inhaler",
  respules: "inhaler",
  powder: "powder",
  sachet: "sachet",
  granules: "sachet",
  soap: "soap",
  shampoo: "shampoo",
};

const CONTAINER_FORMS: Record<string, DosageForm> = {
  vial: "injection",
  ampoule: "injection",
  "prefilled syringe": "injection",
  "pre-filled pen": "injection",
  cartridge: "injection",
  penfill: "injection",
  flexpen: "injection",
  sachet: "sachet",
  strip: "tablet",
};

export function collapse(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function detectForm(name: string, packLabel = ""): DosageForm {
  const words = collapse(name).toLowerCase().split(" ");
  for (let i = words.length - 1; i >= 0; i--) {
    const f = FORM_WORDS[words[i]];
    if (f) return f;
  }
  const container = packLabel.toLowerCase().split(" of ")[0].trim();
  return CONTAINER_FORMS[container] ?? "other";
}

export type Ingredient = { salt: string; strength: string };

/** "Amoxycillin  (500mg) " → { salt: "Amoxycillin", strength: "500mg" } */
export function parseIngredient(raw: string): Ingredient | null {
  const s = collapse(raw);
  if (!s) return null;
  const m = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const salt = collapse(m ? m[1] : s);
  if (!salt) return null;
  return { salt, strength: m ? collapse(m[2]).toLowerCase().replace(/\s+/g, "") : "" };
}

export function saltKeyOf(salt: string) {
  return collapse(salt).toLowerCase();
}

/**
 * Keys used to find substitutes:
 * - compositionKey: same salts AND strengths (true substitute), order-independent
 * - saltKey: same salts, any strength (related products)
 */
export function compositionKeys(ingredients: Ingredient[]) {
  const sorted = [...ingredients].sort((a, b) => saltKeyOf(a.salt).localeCompare(saltKeyOf(b.salt)));
  return {
    compositionKey: sorted.map((i) => `${saltKeyOf(i.salt)} ${i.strength}`.trim()).join(" + "),
    saltKey: sorted.map((i) => saltKeyOf(i.salt)).join(" + "),
  };
}

export function formatComposition(ingredients: Ingredient[]) {
  return ingredients.map((i) => (i.strength ? `${i.salt} (${i.strength})` : i.salt)).join(" + ");
}

/** Lower-cased, punctuation-light text used for prefix / fallback search. */
export function searchable(s: string) {
  return collapse(s.toLowerCase().replace(/[^\p{L}\p{N}%+./ -]/gu, " "));
}

/** Retailer margin on MRP, as a percentage rounded to one decimal. */
export function marginPercent(mrp: number, price: number) {
  if (!(mrp > 0) || !(price >= 0)) return 0;
  return Math.round(((mrp - price) / mrp) * 1000) / 10;
}
