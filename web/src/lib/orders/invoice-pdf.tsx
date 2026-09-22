import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { stateName } from "@/lib/india";
import type { OrderDoc } from "@/lib/models/order";
import { amountInWords, hsnSummary } from "@/lib/orders/gst";

// Built-in Helvetica has no ₹ glyph, so amounts are printed as "Rs.".
const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const monthYear = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { month: "2-digit", year: "2-digit", timeZone: "Asia/Kolkata" });

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: "Helvetica", color: "#0f1f1b" },
  row: { flexDirection: "row" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 2 },
  subtitle: { fontSize: 7, textAlign: "center", color: "#5b6b66", marginBottom: 10 },
  box: { borderWidth: 0.75, borderColor: "#9aa7a3", padding: 6 },
  label: { color: "#5b6b66", fontSize: 7 },
  bold: { fontFamily: "Helvetica-Bold" },
  partyName: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2 },
  th: { fontFamily: "Helvetica-Bold", backgroundColor: "#effaf6", paddingVertical: 3, paddingHorizontal: 2 },
  td: { paddingVertical: 3, paddingHorizontal: 2 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#d5ddda" },
  right: { textAlign: "right" },
  footer: { position: "absolute", bottom: 20, left: 28, right: 28, fontSize: 7, color: "#5b6b66", textAlign: "center" },
});

// Column widths (sum 100%). Tax columns differ for intra vs inter-state.
function columns(interState: boolean) {
  const base = [
    { key: "sn", title: "#", w: 3 },
    { key: "name", title: "Product", w: interState ? 25 : 21 },
    { key: "hsn", title: "HSN", w: 6 },
    { key: "batch", title: "Batch", w: 8 },
    { key: "exp", title: "Exp", w: 5 },
    { key: "qty", title: "Qty", w: 5, right: true },
    { key: "mrp", title: "MRP", w: 7, right: true },
    { key: "rate", title: "Rate", w: 7, right: true },
    { key: "taxable", title: "Taxable", w: 9, right: true },
    { key: "gst", title: "GST%", w: 5, right: true },
  ];
  const tax = interState
    ? [{ key: "igst", title: "IGST", w: 9, right: true }]
    : [
        { key: "cgst", title: "CGST", w: 7, right: true },
        { key: "sgst", title: "SGST", w: 7, right: true },
      ];
  return [...base, ...tax, { key: "total", title: "Amount", w: 11, right: true }];
}

function Party({ title, p }: { title: string; p: OrderDoc["buyer"] }) {
  return (
    <View style={[s.box, { flex: 1 }]}>
      <Text style={s.label}>{title}</Text>
      <Text style={s.partyName}>{p.name}</Text>
      <Text>{p.address}</Text>
      <Text>
        State: {stateName(p.stateCode)} ({p.stateCode})
      </Text>
      {p.gstin ? <Text>GSTIN: {p.gstin}</Text> : null}
      {p.drugLicenses ? <Text>D.L. No.: {p.drugLicenses}</Text> : null}
      {p.phone ? <Text>Phone: {p.phone}</Text> : null}
    </View>
  );
}

function InvoiceDocument({ order }: { order: OrderDoc }) {
  const cols = columns(order.interState);
  const hsn = hsnSummary(order.items);
  const t = order.totals!;
  const cell = (key: string, i: number, it: OrderDoc["items"][number]) =>
    ({
      sn: String(i + 1),
      name: `${it.name}${it.packSizeLabel ? ` (${it.packSizeLabel})` : ""}`,
      hsn: it.hsn,
      batch: it.batchNo,
      exp: monthYear(it.expiryDate),
      qty: String(it.qty),
      mrp: money(it.mrp),
      rate: money(it.price),
      taxable: money(it.taxable),
      gst: `${it.gstRate}%`,
      cgst: money(it.cgst),
      sgst: money(it.sgst),
      igst: money(it.igst),
      total: money(it.total),
    })[key] ?? "";

  return (
    <Document title={`Invoice ${order.invoice?.number}`} author={order.seller.name} creator="PharmaBharat">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>TAX INVOICE</Text>
        <Text style={s.subtitle}>Original for recipient</Text>

        <View style={[s.row, { gap: 6, marginBottom: 6 }]}>
          <Party title="Sold by" p={order.seller} />
          <Party title="Bill to / Ship to" p={order.buyer} />
          <View style={[s.box, { width: 170 }]}>
            <Text style={s.label}>Invoice no.</Text>
            <Text style={s.bold}>{order.invoice?.number}</Text>
            <Text style={[s.label, { marginTop: 4 }]}>Invoice date</Text>
            <Text>{order.invoice?.date ? date(order.invoice.date) : ""}</Text>
            <Text style={[s.label, { marginTop: 4 }]}>Order no.</Text>
            <Text>{order.orderNo}</Text>
            <Text style={[s.label, { marginTop: 4 }]}>Place of supply</Text>
            <Text>
              {stateName(order.buyer.stateCode)} ({order.buyer.stateCode})
            </Text>
            <Text style={[s.label, { marginTop: 4 }]}>Payment</Text>
            <Text>
              {order.payment?.mode === "cod" ? "Cash on delivery" : "Credit"} ·{" "}
              {order.payment?.status === "paid" ? "Paid" : "Unpaid"}
            </Text>
          </View>
        </View>

        <View style={{ borderWidth: 0.75, borderColor: "#9aa7a3" }}>
          <View style={[s.row, { borderBottomWidth: 0.75, borderColor: "#9aa7a3" }]}>
            {cols.map((c) => (
              <Text key={c.key} style={[s.th, { width: `${c.w}%` }, c.right ? s.right : {}]}>
                {c.title}
              </Text>
            ))}
          </View>
          {order.items.map((it, i) => (
            <View key={i} style={s.tableRow} wrap={false}>
              {cols.map((c) => (
                <Text key={c.key} style={[s.td, { width: `${c.w}%` }, c.right ? s.right : {}]}>
                  {cell(c.key, i, it)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={[s.row, { gap: 6, marginTop: 6 }]} wrap={false}>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={[s.bold, { marginBottom: 3 }]}>HSN summary</Text>
            <View style={[s.row, { borderBottomWidth: 0.5, borderColor: "#d5ddda" }]}>
              {["HSN", "GST%", "Taxable", order.interState ? "IGST" : "CGST", order.interState ? "" : "SGST"].map((h, i) => (
                <Text key={i} style={[s.label, { width: "20%" }, i > 1 ? s.right : {}]}>
                  {h}
                </Text>
              ))}
            </View>
            {hsn.map((r) => (
              <View key={`${r.hsn}-${r.gstRate}`} style={s.row}>
                <Text style={{ width: "20%" }}>{r.hsn}</Text>
                <Text style={{ width: "20%" }}>{r.gstRate}%</Text>
                <Text style={[{ width: "20%" }, s.right]}>{money(r.taxable)}</Text>
                <Text style={[{ width: "20%" }, s.right]}>{money(order.interState ? r.igst : r.cgst)}</Text>
                <Text style={[{ width: "20%" }, s.right]}>{order.interState ? "" : money(r.sgst)}</Text>
              </View>
            ))}
            <Text style={[s.label, { marginTop: 8 }]}>Amount in words</Text>
            <Text style={s.bold}>{amountInWords(t.grandTotal)}</Text>
          </View>

          <View style={[s.box, { width: 200 }]}>
            {[
              ["Taxable value", t.taxable],
              ...(order.interState
                ? [["IGST", t.igst]]
                : [
                    ["CGST", t.cgst],
                    ["SGST", t.sgst],
                  ]),
              ["Round off", t.roundOff],
            ].map(([k, v]) => (
              <View key={k as string} style={[s.row, { justifyContent: "space-between", marginBottom: 2 }]}>
                <Text>{k}</Text>
                <Text>{money(v as number)}</Text>
              </View>
            ))}
            <View
              style={[s.row, { justifyContent: "space-between", borderTopWidth: 0.75, borderColor: "#9aa7a3", paddingTop: 4, marginTop: 2 }]}
            >
              <Text style={[s.bold, { fontSize: 10 }]}>Grand total</Text>
              <Text style={[s.bold, { fontSize: 10 }]}>Rs. {money(t.grandTotal)}</Text>
            </View>
            <Text style={[s.label, { marginTop: 18, textAlign: "right" }]}>For {order.seller.name}</Text>
            <Text style={[s.label, { marginTop: 18, textAlign: "right" }]}>Authorised signatory</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          Computer-generated invoice via PharmaBharat. Goods once sold will be taken back only as per the seller&apos;s return policy.
        </Text>
      </Page>
    </Document>
  );
}

export function renderInvoicePdf(order: OrderDoc) {
  return renderToBuffer(<InvoiceDocument order={order} />);
}
