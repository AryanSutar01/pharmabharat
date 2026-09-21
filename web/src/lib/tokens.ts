import "server-only";
import { createHash, randomBytes } from "node:crypto";

export function newToken() {
  return randomBytes(32).toString("base64url");
}

/** Only hashes are stored, so a DB leak doesn't expose usable invite links. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
