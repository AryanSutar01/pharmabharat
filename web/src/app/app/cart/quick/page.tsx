import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { requireBuyer } from "@/lib/orders/cart";
import { matchPurchaseList, reorderLines } from "@/lib/orders/reorder";
import { lowStock } from "@/lib/retail/alerts";
import { QuickOrder } from "./quick-order";

export const metadata = { title: "Quick order" };

export default async function QuickOrderPage({ searchParams }: PageProps<"/app/cart/quick">) {
  const { business } = await requireBuyer();
  const t = await getTranslations("cart");
  const sp = await searchParams;

  // "Buy again" arrives as ?reorder=<orderId>; the shop's low-stock list as ?lowstock=1.
  const reorder = typeof sp.reorder === "string" && isValidObjectId(sp.reorder) ? sp.reorder : null;
  const fromLowStock = sp.lowstock === "1" && business.type === "retailer";
  const lines = reorder
    ? await reorderLines(reorder, business._id)
    : fromLowStock
      ? await matchPurchaseList(
          (await lowStock(business._id, 60)).map((r) => ({ raw: r.name, name: r.name, qty: r.suggestedQty })),
          business._id,
        )
      : null;

  return (
    <>
      <PageHeader
        title={t("quickTitle")}
        description={t("quickSubtitle")}
        action={
          <Link href="/app/cart" className="text-sm text-brand-700 hover:underline">
            {t("title")} →
          </Link>
        }
      />
      <QuickOrder
        initialLines={lines ?? undefined}
        sourceLabel={lines ? (fromLowStock ? t("quickFromLowStock") : t("quickFromOrder")) : undefined}
      />
    </>
  );
}
