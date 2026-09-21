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
