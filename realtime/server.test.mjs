import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { io as connect } from "socket.io-client";
import { signToken, verifyToken } from "./token.mjs";

const SECRET = "test-secret-0123456789";
const PORT = 4099;
const URL = `http://localhost:${PORT}`;
let proc;

const token = (rooms, ttlSec = 60) => signToken({ rooms, exp: Math.floor(Date.now() / 1000) + ttlSec }, SECRET);

function client(tok) {
  return new Promise((resolve, reject) => {
    const s = connect(URL, { auth: { token: tok }, transports: ["websocket"], reconnection: false });
    s.on("connect", () => resolve(s));
    s.on("connect_error", (e) => reject(e));
  });
}

const publish = (body, secret = SECRET) =>
  fetch(`${URL}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

before(async () => {
  proc = spawn(process.execPath, ["server.mjs"], {
    env: { ...process.env, PORT: String(PORT), REALTIME_SECRET: SECRET, APP_ORIGIN: "http://localhost:3000" },
    stdio: "pipe",
  });
  await new Promise((resolve) => proc.stdout.on("data", (d) => String(d).includes("listening") && resolve()));
});

after(() => proc.kill());

test("tokens: valid round-trip, tampered and expired are rejected", () => {
  const t = token(["biz:1"]);
  assert.deepEqual(verifyToken(t, SECRET).rooms, ["biz:1"]);
  assert.equal(verifyToken(t, "other-secret-000000"), null);
  assert.equal(verifyToken(t.slice(0, -2) + "xx", SECRET), null);
  assert.equal(verifyToken(token(["biz:1"], -10), SECRET), null);
});

test("connections without a valid token are refused", async () => {
  await assert.rejects(client("garbage"), /unauthorized/);
  await assert.rejects(client(token(["biz:1"], -5)), /unauthorized/);
});

test("events reach only sockets whose token grants the room", async () => {
  const a = await client(token(["biz:A", "community:india"]));
  const b = await client(token(["biz:B"]));
  const got = { a: [], b: [] };
  a.on("message", (m) => got.a.push(m));
  b.on("message", (m) => got.b.push(m));

  assert.equal((await publish({ rooms: ["biz:A"], event: "message", payload: { n: 1 } })).status, 200);
  assert.equal((await publish({ rooms: ["community:india"], event: "message", payload: { n: 2 } })).status, 200);
  assert.equal((await publish({ rooms: ["biz:B"], event: "message", payload: { n: 3 } })).status, 200);
  await new Promise((r) => setTimeout(r, 300));

  assert.deepEqual(got.a.map((m) => m.n), [1, 2]);
  assert.deepEqual(got.b.map((m) => m.n), [3]);
  a.close();
  b.close();
});

test("publishing requires the shared secret", async () => {
  assert.equal((await publish({ rooms: ["biz:A"], event: "x", payload: {} }, "wrong-secret-000000")).status, 401);
  const health = await (await fetch(`${URL}/health`)).json();
  assert.equal(health.ok, true);
});
