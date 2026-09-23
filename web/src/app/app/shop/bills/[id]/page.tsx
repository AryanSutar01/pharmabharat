import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { amountInWords } from "@/lib/orders/gst";
import { getBill } from "@/lib/retail/billing";
import { requireShop } from "@/lib/retail/guard";
import { PrintButton } from "./print-button";

export const metadata = { title: "Bill" };

export default async function BillPage({ params }: PageProps<"/app/shop/bills/[id]">) {
  const { business } = await requireShop("retail.sell");
  const { id } = await params;
  const bill = await getBill(business._id, id);
  if (!bill) notFound();

  const t = await getTranslations("shop");
  const format = await getFormatter();
  const inr = (v: number) => format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const shopName = business.tradeName || business.legalName;
  const address = business.address;
  const licence = business.drugLicenses?.map((l) => `${l.form}: ${l.number}`).join(" · ");

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={t("billNo", { number: bill.billNo })}
          description={format.dateTime(new Date(bill.createdAt), { dateStyle: "medium", timeStyle: "short" })}
          action={
            <div className="flex gap-2">
              <Link href="/app/shop/billing" className={buttonClass("secondary")}>
                {t("newBill")}
              </Link>
              <PrintButton label={t("print")} />
            </div>
          }
        />
      </div>

      {/* The receipt itself: the only thing that reaches the printer. */}
      <Card className="mx-auto max-w-2xl print:max-w-none print:border-0 print:shadow-none">
        <div className="space-y-4 p-5 text-sm">
          <header className="border-b border-line pb-3 text-center">
            <h1 className="text-lg font-bold">{shopName}</h1>
            {address ? (
              <p className="text-xs text-muted">
                {[address.line1, address.line2, address.city, address.pincode].filter(Boolean).join(", ")}
              </p>
            ) : null}
            <p className="text-xs text-muted">
              {business.phone ? `${t("phone")}: ${business.phone}` : ""}
              {business.gstin ? ` · GSTIN: ${business.gstin}` : ""}
            </p>
            {licence ? <p className="text-xs text-muted">{licence}</p> : null}
          </header>

          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <div>
              <p>
                <b>{t("billNo", { number: bill.billNo })}</b>
              </p>
              <p className="text-muted">{format.dateTime(new Date(bill.createdAt), { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <div className="text-right">
              <p>
                <b>{bill.customer?.name || t("walkIn")}</b>
              </p>
              {bill.customer?.phone ? <p className="text-muted">{bill.customer.phone}</p> : null}
            </div>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-y border-line text-left text-muted">
                <th className="py-1.5">{t("medicine")}</th>
                <th className="py-1.5">{t("batch")}</th>
                <th className="py-1.5 text-right">{t("qty")}</th>
                <th className="py-1.5 text-right">{t("mrp")}</th>
                <th className="py-1.5 text-right">{t("amount")}</th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.map((l, i) => (
                <tr key={i} className="border-b border-line/60 align-top">
                  <td className="py-1.5">
                    <span className="font-medium">{l.name}</span>
                    <span className="block text-muted">
                      {l.packSizeLabel}
                      {l.hsn ? ` · HSN ${l.hsn}` : ""} · {l.gstRate}%
                    </span>
                  </td>
                  <td className="py-1.5">
                    {l.batchNo}
                    <span className="block text-muted">
                      {format.dateTime(new Date(l.expiryDate), { month: "2-digit", year: "2-digit" })}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{l.qty}</td>
                  <td className="py-1.5 text-right tabular-nums">{inr(l.mrp)}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {inr(l.total)}
                    {l.discount ? <span className="block text-muted">− {inr(l.discount)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="ml-auto max-w-xs space-y-1 text-xs">
            <Row label={t("subtotal")} value={inr(bill.totals?.gross ?? 0)} />
            {bill.totals?.discount ? <Row label={t("discount")} value={`− ${inr(bill.totals.discount)}`} /> : null}
            <Row label={t("taxable")} value={inr(bill.totals?.taxable ?? 0)} />
            <Row label={t("cgst")} value={inr(bill.totals?.cgst ?? 0)} />
            <Row label={t("sgst")} value={inr(bill.totals?.sgst ?? 0)} />
            {bill.totals?.redeemed ? <Row label={t("loyaltyPaid")} value={`− ${inr(bill.totals.redeemed)}`} /> : null}
            {bill.totals?.roundOff ? <Row label={t("roundOff")} value={inr(bill.totals.roundOff)} /> : null}
            <div className="flex justify-between border-t border-line pt-1.5 text-sm font-semibold">
              <dt>{t("payable")}</dt>
              <dd className="tabular-nums">{inr(bill.totals?.grandTotal ?? 0)}</dd>
            </div>
          </dl>

          <p className="text-xs text-muted">{amountInWords(bill.totals?.grandTotal ?? 0)}</p>
          <p className="text-xs text-muted">
            {t("paidBy")}: {t(`payMode.${bill.payment?.mode ?? "cash"}`)}
          </p>

          {bill.prescription?.doctorName ? (
            <p className="text-xs text-muted">
              {t("rxDoctor")}: {bill.prescription.doctorName}
              {bill.prescription.registrationNo ? ` (${bill.prescription.registrationNo})` : ""}
              {bill.prescription.patientName ? ` · ${t("rxPatient")}: ${bill.prescription.patientName}` : ""}
            </p>
          ) : null}

          <footer className="border-t border-line pt-3 text-center text-[11px] text-muted">
            <p>{t("billFooter")}</p>
            <p>{t("billFooterTwo")}</p>
          </footer>
        </div>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
