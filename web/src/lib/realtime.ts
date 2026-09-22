import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

// Same token format as realtime/token.mjs — keep them in sync.
const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

export function realtimeConfigured() {
  const e = env();
  return Boolean(e.REALTIME_URL && e.REALTIME_SECRET);
}

/** Short-lived token telling the realtime service which rooms this browser may join. */
export function signRealtimeToken(rooms: string[], ttlSeconds = 10 * 60) {
  const secret = env().REALTIME_SECRET!;
  const body = b64url(JSON.stringify({ rooms, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * Best-effort broadcast. Never throws and gives up after 2s: the message is
 * already saved, and clients catch up by polling if a push is missed.
 */
export async function publish(rooms: string[], event: string, payload: unknown) {
  if (!realtimeConfigured() || !rooms.length) return;
  const e = env();
  try {
    await fetch(`${e.REALTIME_URL}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${e.REALTIME_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rooms, event, payload }),
      signal: AbortSignal.timeout(2000),
    });
  } catch (err) {
    console.warn("[realtime] publish failed", (err as Error).message);
  }
}

export const rooms = {
  business: (id: unknown) => `biz:${String(id)}`,
  community: (slug: string) => `community:${slug}`,
  /** All support agents. */
  support: "support",
};
