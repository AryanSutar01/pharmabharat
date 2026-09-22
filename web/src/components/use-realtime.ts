"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type Handler = (payload: unknown) => void;

/**
 * Connects to the realtime service with a token from /api/realtime/token.
 * Tokens last 10 minutes; when the server drops us we fetch a fresh one and
 * reconnect. `connected` is false while realtime is unavailable — callers
 * should poll in that case.
 */
export function useRealtime(handlers: Record<string, Handler>) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    let socket: Socket | null = null;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function connect(attempt = 0) {
      if (stopped) return;
      try {
        const res = await fetch("/api/realtime/token", { cache: "no-store" });
        const cfg = (await res.json()) as { enabled?: boolean; url?: string; token?: string };
        if (!cfg.enabled || !cfg.url || !cfg.token || stopped) return; // realtime not configured → polling only
        socket = io(cfg.url, { auth: { token: cfg.token }, transports: ["websocket"], reconnection: false });
        socket.on("connect", () => setConnected(true));
        socket.onAny((event: string, payload: unknown) => handlersRef.current[event]?.(payload));
        const again = () => {
          setConnected(false);
          socket?.removeAllListeners();
          socket = null;
          // Backoff: 2s, 4s, 8s … capped at 60s (a free-tier server may be waking up).
          retry = setTimeout(() => connect(attempt + 1), Math.min(60_000, 2000 * 2 ** attempt));
        };
        socket.on("disconnect", () => {
          attempt = 0; // a clean disconnect (token expiry) reconnects quickly
          again();
        });
        socket.on("connect_error", again);
      } catch {
        retry = setTimeout(() => connect(attempt + 1), Math.min(60_000, 2000 * 2 ** attempt));
      }
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, []);

  return { connected };
}
