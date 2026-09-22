// PharmaBharat realtime service: a stateless Socket.io broadcaster.
//
// - Browsers connect with a short-lived token from the web app
//   (GET /api/realtime/token). The token lists the rooms they may join.
// - The web app saves messages to MongoDB, then POSTs /publish here with the
//   shared secret; this service only relays events to connected sockets.
// - No database access, so it can sleep on a free tier without losing data
//   (the web client falls back to polling while disconnected).
//
// Env: PORT (default 4000), REALTIME_SECRET (required), APP_ORIGIN (CORS, comma-separated)

import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { Server } from "socket.io";
import { verifyToken } from "./token.mjs";

const PORT = Number(process.env.PORT ?? 4000);
const SECRET = process.env.REALTIME_SECRET;
const ORIGINS = (process.env.APP_ORIGIN ?? "http://localhost:3000").split(",").map((s) => s.trim());
const MAX_BODY = 64 * 1024;

if (!SECRET || SECRET.length < 16) {
  console.error("REALTIME_SECRET (16+ chars) is required");
  process.exit(1);
}

function authorizedPublisher(req) {
  const given = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const httpServer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, clients: io.engine.clientsCount });

  if (req.method === "POST" && req.url === "/publish") {
    if (!authorizedPublisher(req)) return json(res, 401, { error: "unauthorized" });
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) req.destroy();
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        const { rooms, event, payload } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!Array.isArray(rooms) || !rooms.length || typeof event !== "string") return json(res, 400, { error: "invalid" });
        io.to(rooms.filter((r) => typeof r === "string")).emit(event, payload);
        json(res, 200, { ok: true });
      } catch {
        json(res, 400, { error: "invalid" });
      }
    });
    return;
  }
  json(res, 404, { error: "not_found" });
});

const io = new Server(httpServer, {
  cors: { origin: ORIGINS, credentials: false },
  pingInterval: 25_000,
  pingTimeout: 20_000,
});

io.use((socket, next) => {
  const claims = verifyToken(socket.handshake.auth?.token, SECRET);
  if (!claims || !Array.isArray(claims.rooms)) return next(new Error("unauthorized"));
  socket.data.claims = claims;
  next();
});

io.on("connection", (socket) => {
  // Rooms are fixed by the signed token — clients cannot choose arbitrary rooms.
  for (const room of socket.data.claims.rooms) socket.join(room);
  // Tokens are short-lived; drop the socket when it expires so the client re-auths.
  const ttl = socket.data.claims.exp * 1000 - Date.now();
  const timer = setTimeout(() => socket.disconnect(true), Math.max(ttl, 1000));
  socket.on("disconnect", () => clearTimeout(timer));
});

httpServer.listen(PORT, () => console.log(`[realtime] listening on :${PORT} (origins: ${ORIGINS.join(", ")})`));
