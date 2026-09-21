import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const e = env();
  transporter =
    e.SMTP_USER && e.SMTP_PASS
      ? nodemailer.createTransport({
          host: e.SMTP_HOST,
          port: e.SMTP_PORT,
          secure: e.SMTP_PORT === 465,
          auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
        })
      : null;
  return transporter;
}

/**
 * Sends an email. Without SMTP credentials (local dev) the message is logged
 * instead, so flows never break just because mail isn't configured.
 * Failures are logged, not thrown: email is a side effect, not the action.
 */
export async function sendMail(msg: { to: string; subject: string; html: string; text: string }) {
  const t = getTransporter();
  if (!t) {
    console.info(`[mail:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    return;
  }
  try {
    await t.sendMail({ from: env().MAIL_FROM, ...msg });
  } catch (err) {
    console.error("[mail] send failed", err);
  }
}
