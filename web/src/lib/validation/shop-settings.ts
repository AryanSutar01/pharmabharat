import { z } from "zod";

export const shopSettingsSchema = z.object({
  reorderCoverDays: z.coerce.number().int().min(1, "invalid").max(120, "invalid"),
  retentionMonths: z.coerce.number().int().min(6, "invalid").max(120, "invalid"),
  loyaltyActive: z.coerce.boolean(),
  pointsPerHundred: z.coerce.number().min(0, "invalid").max(100, "invalid"),
  pointValue: z.coerce.number().min(0, "invalid").max(100, "invalid"),
  minRedeemPoints: z.coerce.number().int().min(0, "invalid").max(100_000, "invalid"),
  expiryMonths: z.coerce.number().int().min(1, "invalid").max(120, "invalid"),
});

export type ShopSettingsInput = z.input<typeof shopSettingsSchema>;
