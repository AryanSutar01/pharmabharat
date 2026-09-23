import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runExpiryAlerts } from "@/lib/alerts/expiry";
import { runLicenceChecks } from "@/lib/compliance/service";
import { env } from "@/lib/env";
import { runPaymentReminders } from "@/lib/ledger/reminders";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return false; // disabled until configured
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily jobs. Triggered by Vercel Cron (see vercel.json) or any external
 * scheduler (e.g. cron-job.org on Render) with "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const started = Date.now();
  const expiry = await runExpiryAlerts();
  const payments = await runPaymentReminders();
  const licences = await runLicenceChecks();
  return NextResponse.json({ ok: true, expiry, payments, licences, ms: Date.now() - started });
}
