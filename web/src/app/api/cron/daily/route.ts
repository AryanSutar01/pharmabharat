import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runExpiryAlerts } from "@/lib/alerts/expiry";
import { env } from "@/lib/env";

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
  return NextResponse.json({ ok: true, expiry, ms: Date.now() - started });
}
