// Tiny signed token shared by the web app (signer) and this service (verifier).
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, secret)).
// The web app has an identical implementation in web/src/lib/realtime.ts — keep them in sync.

import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64url");

export function signToken(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

/** Returns the payload if the signature is valid and it hasn't expired, else null. */
export function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(b64url(createHmac("sha256", secret).update(body).digest()));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}
