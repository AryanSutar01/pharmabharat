// Integration tests: load .env.local, then force a separate throwaway database.
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
process.env.MONGODB_DB = "pharmabharat_test";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
// Tests never push to a live realtime server.
delete process.env.REALTIME_URL;
delete process.env.REALTIME_SECRET;
