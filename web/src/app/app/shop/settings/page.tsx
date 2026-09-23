import { getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/ui";
import { shopSettings } from "@/lib/models/shop-settings";
import { requireShop } from "@/lib/retail/guard";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Shop settings" };

export default async function ShopSettingsPage() {
  const { business } = await requireShop("retail.manage");
  const t = await getTranslations("shop");
  const settings = await shopSettings(business._id);

  return (
    <>
      <PageHeader title={t("settingsTitle")} description={t("settingsSubtitle")} />
      <Card className="max-w-2xl">
        <SettingsForm
          values={{
            reorderCoverDays: settings.reorderCoverDays,
            retentionMonths: settings.retentionMonths,
            loyaltyActive: settings.loyalty.active,
            pointsPerHundred: settings.loyalty.pointsPerHundred,
            pointValue: settings.loyalty.pointValue,
            minRedeemPoints: settings.loyalty.minRedeemPoints,
            expiryMonths: settings.loyalty.expiryMonths,
          }}
        />
      </Card>
    </>
  );
}
