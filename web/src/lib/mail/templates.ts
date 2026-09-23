import { env } from "@/lib/env";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(opts: { heading: string; body: string; cta?: { label: string; url: string } }) {
  const button = opts.cta
    ? `<p style="margin:24px 0"><a href="${esc(opts.cta.url)}" style="background:#0d8467;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f8f7;font-family:Arial,Helvetica,sans-serif;color:#0f1f1b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e3e8e6;border-radius:12px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e3e8e6;font-weight:700;font-size:18px;color:#0d8467">PharmaBharat</td></tr>
<tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${esc(opts.heading)}</h1>${opts.body}${button}
<p style="font-size:12px;color:#5b6b66;margin-top:32px">You received this because of activity on your PharmaBharat account.</p></td></tr>
</table></td></tr></table></body></html>`;
}

const p = (s: string) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${s}</p>`;

export function inviteEmail(opts: { businessName: string; inviterName: string; role: string; token: string }) {
  const url = `${env().BETTER_AUTH_URL}/invite/${opts.token}`;
  const subject = `${opts.inviterName} invited you to ${opts.businessName} on PharmaBharat`;
  return {
    subject,
    html: layout({
      heading: "You're invited",
      body:
        p(`<b>${esc(opts.inviterName)}</b> has invited you to join <b>${esc(opts.businessName)}</b> as <b>${esc(opts.role)}</b>.`) +
        p("Sign in with the Google account for this email address to accept. The link expires in 7 days."),
      cta: { label: "Accept invitation", url },
    }),
    text: `${subject}\nRole: ${opts.role}\nAccept: ${url}\nThe link expires in 7 days.`,
  };
}

export function kycDecisionEmail(opts: { businessName: string; approved: boolean; remarks?: string }) {
  const url = `${env().BETTER_AUTH_URL}/${opts.approved ? "app" : "onboarding"}`;
  const subject = opts.approved
    ? `${opts.businessName} is verified on PharmaBharat`
    : `Action needed: verification for ${opts.businessName}`;
  const remarks = opts.remarks ? p(`<b>Reviewer notes:</b> ${esc(opts.remarks)}`) : "";
  return {
    subject,
    html: layout({
      heading: opts.approved ? "Your business is verified" : "Please update your details",
      body:
        (opts.approved
          ? p("Your KYC has been approved. You can now start trading on PharmaBharat.")
          : p("We could not verify your business with the details provided.")) + remarks,
      cta: { label: opts.approved ? "Open PharmaBharat" : "Update details", url },
    }),
    text: `${subject}\n${opts.remarks ?? ""}\n${url}`,
  };
}

// ------------------------------------------------------------------ orders

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type OrderSummary = {
  id: string;
  orderNo: string;
  counterparty: string;
  itemCount: number;
  grandTotal: number;
};

function orderTable(orders: OrderSummary[]) {
  const rows = orders
    .map(
      (o) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e3e8e6">${esc(o.orderNo)}<br><span style="color:#5b6b66;font-size:13px">${esc(o.counterparty)} · ${o.itemCount} item(s)</span></td><td style="padding:8px 0;border-bottom:1px solid #e3e8e6;text-align:right;font-weight:600">${inr(o.grandTotal)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;margin:8px 0 4px">${rows}</table>`;
}

export function newOrderSellerEmail(o: OrderSummary) {
  const url = `${env().BETTER_AUTH_URL}/app/orders/${o.id}`;
  const subject = `New order ${o.orderNo} from ${o.counterparty}`;
  return {
    subject,
    html: layout({
      heading: "You have a new order",
      body: orderTable([o]) + p("Accept or reject it from your Orders page. Stock has been reserved for this order."),
      cta: { label: "Review order", url },
    }),
    text: `${subject}\nTotal: ${inr(o.grandTotal)}\n${url}`,
  };
}

export function orderConfirmationEmail(orders: OrderSummary[]) {
  const url = `${env().BETTER_AUTH_URL}/app/orders`;
  const subject =
    orders.length === 1 ? `Order ${orders[0].orderNo} placed` : `${orders.length} orders placed on PharmaBharat`;
  return {
    subject,
    html: layout({
      heading: "Order placed",
      body:
        p(orders.length > 1 ? "Your cart was split into one order per distributor:" : "Thank you for your order.") +
        orderTable(orders) +
        p("You'll get an email when each distributor accepts and dispatches your order."),
      cta: { label: "Track orders", url },
    }),
    text: `${subject}\n${orders.map((o) => `${o.orderNo} ${o.counterparty} ${inr(o.grandTotal)}`).join("\n")}\n${url}`,
  };
}

const STATUS_COPY: Record<string, { heading: string; line: string }> = {
  accepted: { heading: "Order accepted", line: "The distributor has accepted your order. Your GST invoice is ready." },
  packed: { heading: "Order packed", line: "Your order has been packed and will be dispatched soon." },
  dispatched: { heading: "Order dispatched", line: "Your order is on its way." },
  delivered: { heading: "Order delivered", line: "Your order has been marked as delivered." },
  rejected: { heading: "Order rejected", line: "The distributor could not fulfil this order." },
  cancelled: { heading: "Order cancelled", line: "This order has been cancelled." },
};

export function orderStatusEmail(o: OrderSummary & { status: string; note?: string; hasInvoice: boolean }) {
  const base = env().BETTER_AUTH_URL;
  const copy = STATUS_COPY[o.status] ?? { heading: "Order updated", line: `Status: ${o.status}` };
  const subject = `${copy.heading}: ${o.orderNo}`;
  const invoiceLink = o.hasInvoice
    ? `<p style="margin:0 0 12px"><a href="${esc(`${base}/api/orders/${o.id}/invoice`)}" style="color:#0d8467;font-weight:600">Download GST invoice (PDF)</a></p>`
    : "";
  return {
    subject,
    html: layout({
      heading: copy.heading,
      body:
        orderTable([o]) +
        p(copy.line) +
        (o.note ? p(`<b>Note from ${esc(o.counterparty)}:</b> ${esc(o.note)}`) : "") +
        invoiceLink,
      cta: { label: "View order", url: `${base}/app/orders/${o.id}` },
    }),
    text: `${subject}\n${copy.line}\n${o.note ?? ""}\n${base}/app/orders/${o.id}`,
  };
}

// ------------------------------------------------------------------ alerts

export function paymentReminderEmail(opts: {
  buyerName: string;
  sellerName: string;
  invoices: { orderNo: string; invoiceNo?: string; amount: number; dueAt: Date; daysOverdue: number }[];
  total: number;
}) {
  const subject = `Payment reminder from ${opts.sellerName} — ${inr(opts.total)} overdue`;
  const rows = opts.invoices
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.invoiceNo || i.orderNo)}</td><td style="padding:6px 0">${i.dueAt.toLocaleDateString("en-IN")}</td><td style="padding:6px 0;color:#b42318">${i.daysOverdue}d</td><td style="padding:6px 0;text-align:right">${inr(i.amount)}</td></tr>`,
    )
    .join("");
  return {
    subject,
    html: layout({
      heading: "Payment reminder",
      body:
        p(`Dear ${esc(opts.buyerName)}, the following invoices from <b>${esc(opts.sellerName)}</b> are past their due date.`) +
        `<table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">
<tr style="color:#5b6b66;text-align:left"><th style="padding:6px 0">Invoice</th><th style="padding:6px 0">Due</th><th style="padding:6px 0">Late</th><th style="padding:6px 0;text-align:right">Amount</th></tr>
${rows}
<tr><td colspan="3" style="padding:10px 0;border-top:1px solid #e3e8e6;font-weight:700">Total overdue</td><td style="padding:10px 0;border-top:1px solid #e3e8e6;text-align:right;font-weight:700">${inr(opts.total)}</td></tr></table>` +
        p("Please settle directly with the seller. This is a reminder, not a demand notice."),
      cta: { label: "View statement", url: `${env().BETTER_AUTH_URL}/app/ledger?side=buyer` },
    }),
    text: `${subject}\n${opts.invoices
      .map((i) => `${i.invoiceNo || i.orderNo} due ${i.dueAt.toLocaleDateString("en-IN")} — ${inr(i.amount)}`)
      .join("\n")}`,
  };
}

export function priceAlertEmail(opts: { productName: string; from: number; to: number; change: number; link: string }) {
  const url = `${env().BETTER_AUTH_URL}${opts.link}`;
  const dropped = opts.to < opts.from;
  const subject = `${dropped ? "Price drop" : "Price rise"}: ${opts.productName} now ${inr(opts.to)}`;
  return {
    subject,
    html: layout({
      heading: dropped ? "Price dropped" : "Price went up",
      body:
        p(`<b>${esc(opts.productName)}</b>`) +
        p(`Best price changed from <b>${inr(opts.from)}</b> to <b>${inr(opts.to)}</b> (${opts.change > 0 ? "+" : ""}${opts.change}%).`) +
        p("Prices are per pack, excluding GST."),
      cta: { label: "View sellers", url },
    }),
    text: `${subject}\nWas ${inr(opts.from)}, now ${inr(opts.to)} (${opts.change}%)\n${url}`,
  };
}

export function expiryDigestEmail(opts: {
  businessName: string;
  items: { name: string; batchNo: string; expiryDate: Date; daysLeft: number; stock: number }[];
}) {
  const url = `${env().BETTER_AUTH_URL}/app/inventory?filter=expiring`;
  const subject = `${opts.items.length} batch(es) nearing expiry — ${opts.businessName}`;
  const shown = opts.items.slice(0, 25);
  const rows = shown
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #e3e8e6">${esc(i.name)}<br><span style="color:#5b6b66;font-size:13px">Batch ${esc(i.batchNo)} · ${i.stock} in stock</span></td><td style="padding:6px 0;border-bottom:1px solid #e3e8e6;text-align:right;white-space:nowrap;color:${i.daysLeft <= 30 ? "#b91c1c" : "#92400e"}">${i.daysLeft} days<br><span style="color:#5b6b66;font-size:13px">${i.expiryDate.toISOString().slice(0, 10)}</span></td></tr>`,
    )
    .join("");
  const more = opts.items.length > shown.length ? p(`…and ${opts.items.length - shown.length} more.`) : "";
  return {
    subject,
    html: layout({
      heading: "Stock nearing expiry",
      body:
        p("These batches will expire soon. Consider offering a better price or returning them to the manufacturer.") +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${rows}</table>` +
        more +
        p("Batches within 30 days of expiry are hidden from buyers automatically."),
      cta: { label: "Open inventory", url },
    }),
    text: `${subject}\n${opts.items.map((i) => `${i.name} (${i.batchNo}) ${i.daysLeft} days, ${i.stock} in stock`).join("\n")}\n${url}`,
  };
}

// ------------------------------------------------------------------ support

type TicketLike = {
  _id: unknown;
  number: string;
  kind?: string | null;
  businessName: string;
  createdByName: string;
  subject: string;
  category: string;
  priority?: string | null;
  status?: string | null;
  callback?: { phone?: string | null; slot?: string | null; language?: string | null } | null;
  replies: { text: string }[];
};

export function recallEmail(opts: {
  businessName: string;
  audience: "seller" | "buyer";
  productName: string;
  manufacturer?: string;
  batchNo: string;
  severity: "recall" | "advisory";
  reason: string;
  reference?: string;
}) {
  const word = opts.severity === "advisory" ? "Safety advisory" : "Batch recall";
  const subject = `${word}: ${opts.productName} batch ${opts.batchNo}`;
  const action =
    opts.audience === "seller"
      ? "Your listings for this batch have been put on hold. Quarantine the stock and follow the manufacturer's return process."
      : "Our records show you bought this batch. Please quarantine any remaining stock and contact your seller about a return.";
  const url = `${env().BETTER_AUTH_URL}${opts.audience === "seller" ? "/app/inventory" : "/app/orders?filter=all"}`;
  return {
    subject,
    html: layout({
      heading: word,
      body:
        p(`Dear ${esc(opts.businessName)},`) +
        p(
          `<b>${esc(opts.productName)}</b>${opts.manufacturer ? ` (${esc(opts.manufacturer)})` : ""}, batch <b>${esc(opts.batchNo)}</b>, has been withdrawn from the market.`,
        ) +
        p(`<b>Reason:</b> ${esc(opts.reason)}`) +
        (opts.reference ? p(`<b>Reference:</b> ${esc(opts.reference)}`) : "") +
        p(action),
      cta: { label: opts.audience === "seller" ? "Open inventory" : "View orders", url },
    }),
    text: `${subject}
Reason: ${opts.reason}
${opts.reference ?? ""}
${action}
${url}`,
  };
}

export function newTicketStaffEmail(t: TicketLike) {
  const url = `${env().BETTER_AUTH_URL}/support-desk/tickets/${t._id}`;
  const isCallback = t.kind === "callback";
  const subject = `${isCallback ? "📞 Call-back" : "🎫 Ticket"} ${t.number}: ${t.subject} — ${t.businessName}`;
  const callback = isCallback
    ? p(`<b>Call:</b> ${esc(t.callback?.phone ?? "")} · <b>When:</b> ${esc(t.callback?.slot ?? "")} · <b>Language:</b> ${esc(t.callback?.language ?? "en")}`)
    : "";
  const first = t.replies[0]?.text;
  return {
    subject,
    html: layout({
      heading: isCallback ? "New call-back request" : "New support ticket",
      body:
        p(`<b>${esc(t.businessName)}</b> (${esc(t.createdByName)}) · ${esc(t.category)} · priority ${esc(t.priority ?? "normal")}`) +
        callback +
        (first ? p(esc(first).replace(/\n/g, "<br>")) : ""),
      cta: { label: "Open in support desk", url },
    }),
    text: `${subject}\n${first ?? ""}\n${url}`,
  };
}

export function ticketUpdateEmail(opts: { ticket: TicketLike; audience: "business" | "staff"; event: "reply" | "status"; text?: string }) {
  const { ticket: t } = opts;
  const base = env().BETTER_AUTH_URL;
  const url = opts.audience === "business" ? `${base}/app/support/${t._id}` : `${base}/support-desk/tickets/${t._id}`;
  const status = (t.status ?? "").replace(/_/g, " ");
  const subject =
    opts.event === "reply"
      ? `New reply on ${t.number}: ${t.subject}`
      : `${t.number} is now ${status}: ${t.subject}`;
  return {
    subject,
    html: layout({
      heading: opts.event === "reply" ? (opts.audience === "business" ? "Support replied" : `${t.businessName} replied`) : `Ticket ${status}`,
      body:
        p(`<b>${esc(t.number)}</b> · ${esc(t.subject)}`) +
        (opts.text ? p(esc(opts.text).replace(/\n/g, "<br>")) : p(`Status: <b>${esc(status)}</b>`)),
      cta: { label: "View ticket", url },
    }),
    text: `${subject}\n${opts.text ?? ""}\n${url}`,
  };
}
