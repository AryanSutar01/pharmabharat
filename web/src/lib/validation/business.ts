import { z } from "zod";
import { BUSINESS_TYPES } from "@/lib/permissions";
import { PAN_RE, PHONE_RE, PINCODE_RE, STATE_CODES, isValidGstin } from "@/lib/india";

/** Licence forms under the Drugs and Cosmetics Rules, 1945, grouped by business type. */
export const LICENSE_FORMS = {
  retailer: ["20", "21", "20A", "21A", "20F"],
  wholesaler: ["20B", "21B", "20G"],
  company: ["25", "28", "25A", "28A", "25B", "28B"],
} as const;

const trimmed = (max = 200) => z.string().trim().max(max);
const optionalTrimmed = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || undefined)
    .optional();

export const createBusinessSchema = z.object({
  type: z.enum(BUSINESS_TYPES),
  legalName: trimmed().min(2, "required"),
});

const licenseSchema = z.object({
  form: trimmed(4).min(1, "required"),
  number: trimmed(40).min(3, "required").toUpperCase(),
  validTill: z.coerce.date({ error: "invalid_date" }).refine((d) => d > new Date(), "license_expired"),
});

export const businessProfileSchema = z
  .object({
    type: z.enum(BUSINESS_TYPES),
    legalName: trimmed().min(2, "required"),
    tradeName: optionalTrimmed(),
    gstin: trimmed(15).toUpperCase().refine(isValidGstin, "invalid_gstin"),
    pan: trimmed(10).toUpperCase().regex(PAN_RE, "invalid_pan"),
    phone: trimmed(10).regex(PHONE_RE, "invalid_phone"),
    email: z.email("invalid_email").trim().toLowerCase(),
    address: z.object({
      line1: trimmed().min(3, "required"),
      line2: optionalTrimmed(),
      city: trimmed(80).min(2, "required"),
      district: optionalTrimmed(80),
      stateCode: z.enum(STATE_CODES, { error: "required" }),
      pincode: trimmed(6).regex(PINCODE_RE, "invalid_pincode"),
    }),
    drugLicenses: z.array(licenseSchema).min(1, "license_required").max(4),
    pharmacist: z
      .object({ name: optionalTrimmed(120), registrationNumber: optionalTrimmed(40) })
      .optional(),
    fssaiNumber: z
      .string()
      .trim()
      .regex(/^$|^[0-9]{14}$/, "invalid_fssai")
      .transform((v) => v || undefined)
      .optional(),
  })
  .superRefine((b, ctx) => {
    // GSTIN embeds the PAN (chars 3-12) and the state code (chars 1-2).
    if (b.gstin.length === 15 && b.pan.length === 10 && b.gstin.slice(2, 12) !== b.pan) {
      ctx.addIssue({ code: "custom", path: ["pan"], message: "pan_gstin_mismatch" });
    }
    if (b.gstin.length === 15 && b.gstin.slice(0, 2) !== b.address.stateCode) {
      ctx.addIssue({ code: "custom", path: ["address", "stateCode"], message: "state_gstin_mismatch" });
    }
    const allowed = LICENSE_FORMS[b.type] as readonly string[];
    b.drugLicenses.forEach((l, i) => {
      if (!allowed.includes(l.form)) {
        ctx.addIssue({ code: "custom", path: ["drugLicenses", i, "form"], message: "invalid_license_form" });
      }
    });
    if (b.type === "retailer") {
      if (!b.pharmacist?.name) ctx.addIssue({ code: "custom", path: ["pharmacist", "name"], message: "required" });
      if (!b.pharmacist?.registrationNumber)
        ctx.addIssue({ code: "custom", path: ["pharmacist", "registrationNumber"], message: "required" });
    }
  });

export type BusinessProfileInput = z.input<typeof businessProfileSchema>;

/** Flattens zod issues into { "address.city": "required" } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    out[key] ??= issue.message;
  }
  return out;
}
