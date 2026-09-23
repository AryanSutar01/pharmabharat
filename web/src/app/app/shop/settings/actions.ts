"use server";

import { revalidatePath } from "next/cache";
import { ShopSettings } from "@/lib/models/shop-settings";
import { requireShop } from "@/lib/retail/guard";
import { shopSettingsSchema } from "@/lib/validation/shop-settings";

export type SettingsState = { ok?: boolean; errors?: Record<string, string> };

export async function saveShopSettings(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const { business, session } = await requireShop("retail.manage");
  const parsed = shopSettingsSchema.safeParse({
    ...Object.fromEntries(formData),
    loyaltyActive: formData.get("loyaltyActive") === "on",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] = issue.message;
    return { errors };
  }

  const v = parsed.data;
  await ShopSettings.updateOne(
    { businessId: business._id },
    {
      $set: {
        reorderCoverDays: v.reorderCoverDays,
        retentionMonths: v.retentionMonths,
        "loyalty.active": v.loyaltyActive,
        "loyalty.pointsPerHundred": v.pointsPerHundred,
        "loyalty.pointValue": v.pointValue,
        "loyalty.minRedeemPoints": v.minRedeemPoints,
        "loyalty.expiryMonths": v.expiryMonths,
        updatedBy: session.user.id,
      },
    },
    { upsert: true },
  );
  revalidatePath("/app/shop/settings");
  revalidatePath("/app/shop/alerts");
  return { ok: true };
}
