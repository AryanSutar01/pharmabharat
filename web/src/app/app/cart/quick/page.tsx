import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { requireBuyer } from "@/lib/orders/cart";
import { reorderLines } from "@/lib/orders/reorder";
import { QuickOrder } from "./quick-order";

export const metadata = { title: "Quick order" };

export default async function QuickOrderPage({ searchParams }: PageProps<"/app/cart/quick">) {
  const { business } = await requireBuyer();
  const t = await getTranslations("cart");
  const sp = await searchParams;

  // "Buy again" arrives as ?reorder=<orderId> and pre-fills the list.
  const reorder = typeof sp.reorder === "string" && isValidObjectId(sp.reorder) ? sp.reorder : null;
  const lines = reorder ? await reorderLines(reorder, business._id) : null;

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
      <QuickOrder initialLines={lines ?? undefined} sourceLabel={lines ? t("quickFromOrder") : undefined} />
    </>
  );
}
