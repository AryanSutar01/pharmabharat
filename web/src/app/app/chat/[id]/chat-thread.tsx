"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Card, cn } from "@/components/ui";
import { useErrorText } from "@/components/use-error-text";
import { useRealtime } from "@/components/use-realtime";
import type { ChatMessage } from "@/lib/chat/service";

/** Server actions the thread needs. Businesses and support agents pass different implementations. */
export type ChatThreadActions = {
  send: (conversationId: string, input: { text: string; imagePublicId?: string }) => Promise<{ message?: ChatMessage; error?: string }>;
  fetchNew: (conversationId: string, afterIso: string) => Promise<ChatMessage[]>;
  fetchOlder: (conversationId: string, beforeIso: string) => Promise<{ messages: ChatMessage[]; hasMore: boolean }>;
  markRead: (conversationId: string) => Promise<void>;
  uploadSignature: (conversationId: string) => Promise<{
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
    type: string;
    allowed_formats: string;
    uploadUrl: string;
  }>;
  report?: (messageId: string, reason: string) => Promise<unknown>;
};

/** Who is looking: a business member, or a support agent. */
export type ChatViewer = { kind: "business"; businessId: string } | { kind: "support" };

const POLL_MS = 15_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Adds messages, skipping ones we already have (push + send response can race). */
function merge(list: ChatMessage[], incoming: ChatMessage[]) {
  const seen = new Set(list.map((m) => m.id));
  const fresh = incoming.filter((m) => !seen.has(m.id));
  return fresh.length ? [...list, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : list;
}

export function ChatThread(props: {
  conversationId: string;
  viewer: ChatViewer;
  actions: ChatThreadActions;
  backHref: string;
  isCommunity: boolean;
  title: string;
  subtitle: string;
  initialMessages: ChatMessage[];
  initialHasMore: boolean;
  initialOtherReadAt: string | null;
  canUploadImages: boolean;
}) {
  const { conversationId, viewer, actions, isCommunity } = props;
  const isMine = useCallback(
    (m: ChatMessage) => (viewer.kind === "support" ? m.fromSupport : !m.fromSupport && m.senderBusinessId === viewer.businessId),
    [viewer],
  );
  const myReadId = viewer.kind === "support" ? "support" : viewer.businessId;
  const t = useTranslations("chat");
  const err = useErrorText();
  const format = useFormatter();
  const router = useRouter();
  const [messages, setMessages] = useState(props.initialMessages);
  const [hasMore, setHasMore] = useState(props.initialHasMore);
  const [otherReadAt, setOtherReadAt] = useState(props.initialOtherReadAt);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [sending, startSend] = useTransition();
  const [loadingOlder, startOlder] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const lastAt = messages.at(-1)?.createdAt ?? new Date(0).toISOString();
  const lastAtRef = useRef(lastAt);
  useEffect(() => {
    lastAtRef.current = lastAt;
  }, [lastAt]);

  const onIncoming = useCallback(
    (m: ChatMessage) => {
      if (m.conversationId !== conversationId) {
        router.refresh(); // another conversation got a message: update list badges
        return;
      }
      setMessages((list) => merge(list, [m]));
      if (!isMine(m)) void actions.markRead(conversationId);
    },
    [conversationId, isMine, actions, router],
  );

  const { connected } = useRealtime({
    message: (p) => onIncoming(p as ChatMessage),
    read: (p) => {
      const r = p as { conversationId: string; businessId: string; at: string };
      if (r.conversationId === conversationId && r.businessId !== myReadId) setOtherReadAt(r.at);
    },
  });

  // Catch up after (re)connecting, and poll while disconnected.
  useEffect(() => {
    let cancelled = false;
    const catchUp = async () => {
      const fresh = await actions.fetchNew(conversationId, lastAtRef.current);
      if (!cancelled && fresh.length) setMessages((list) => merge(list, fresh));
    };
    void catchUp();
    if (connected) return () => void (cancelled = true);
    const timer = setInterval(catchUp, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [connected, conversationId, actions]);

  // Keep the view pinned to the newest message unless the user scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function send(imagePublicId?: string) {
    const body = imagePublicId ? "" : text.trim();
    if (!body && !imagePublicId) return;
    setError(undefined);
    startSend(async () => {
      const r = await actions.send(conversationId, { text: body, imagePublicId });
      if (r.error) return setError(err(r.error));
      if (!imagePublicId) setText("");
      stickToBottom.current = true;
      setMessages((list) => merge(list, [r.message!]));
      router.refresh(); // update the conversation list preview/order
    });
  }

  async function uploadImage(file: File) {
    setError(undefined);
    if (file.size > MAX_IMAGE_BYTES) return setError(err("file_too_large"));
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError(err("file_type"));
    setUploading(true);
    try {
      const sig = await actions.uploadSignature(conversationId);
      const body = new FormData();
      body.set("file", file);
      body.set("api_key", sig.apiKey);
      body.set("timestamp", String(sig.timestamp));
      body.set("signature", sig.signature);
      body.set("folder", sig.folder);
      body.set("type", sig.type);
      body.set("allowed_formats", sig.allowed_formats);
      const res = await fetch(sig.uploadUrl, { method: "POST", body });
      if (!res.ok) throw new Error("upload_failed");
      const json = (await res.json()) as { public_id: string };
      send(json.public_id);
    } catch {
      setError(err("upload_failed"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function loadOlder() {
    const first = messages[0];
    if (!first) return;
    stickToBottom.current = false;
    startOlder(async () => {
      const r = await actions.fetchOlder(conversationId, first.createdAt);
      setMessages((list) => merge(r.messages, list));
      setHasMore(r.hasMore);
    });
  }

  const lastMine = [...messages].reverse().find(isMine);
  const seen = !isCommunity && lastMine && otherReadAt && otherReadAt >= lastMine.createdAt;

  return (
    <Card className="flex h-[calc(100dvh-11rem)] flex-col overflow-hidden lg:h-full">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link href={props.backHref} className="text-sm text-muted hover:text-ink lg:hidden" aria-label={t("title")}>
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{props.title}</p>
          <p className="truncate text-xs text-muted">{props.subtitle}</p>
        </div>
        <span
          className={cn("shrink-0 text-[11px]", connected ? "text-brand-700" : "text-muted")}
          title={connected ? undefined : t("offline")}
        >
          ● {connected ? t("live") : "…"}
        </span>
      </div>

      <div
        ref={scroller}
        className="flex-1 space-y-2 overflow-y-auto bg-canvas px-3 py-4 sm:px-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {hasMore ? (
          <div className="text-center">
            <button type="button" onClick={loadOlder} disabled={loadingOlder} className="text-xs text-brand-700 hover:underline">
              {t("loadOlder")}
            </button>
          </div>
        ) : null}
        {messages.length === 0 ? <p className="py-10 text-center text-sm text-muted">{t("empty")}</p> : null}
        {messages.map((m) => {
          const mine = isMine(m);
          return (
            <div key={m.id} className={cn("group flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                  mine ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm border border-line bg-white",
                )}
              >
                {!mine && (isCommunity || viewer.kind === "support" || m.fromSupport) ? (
                  <p className="mb-0.5 text-xs font-semibold text-brand-700">
                    {m.senderBusinessName}
                    {m.senderCity ? <span className="font-normal text-muted"> · {m.senderCity}</span> : null}
                  </p>
                ) : null}
                {m.hidden ? (
                  <p className="italic opacity-70">{t("hidden")}</p>
                ) : (
                  <>
                    {m.imageUrl ? (
                      <a href={m.imageUrl} target="_blank" rel="noopener">
                        {/* Signed Cloudinary URL; next/image would re-proxy a URL that's already optimised. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.imageUrl} alt="" className="mb-1 max-h-72 rounded-lg" loading="lazy" />
                      </a>
                    ) : null}
                    {m.text ? <p className="whitespace-pre-wrap break-words">{m.text}</p> : null}
                  </>
                )}
                <p className={cn("mt-0.5 text-[10px]", mine ? "text-white/75" : "text-muted")}>
                  {mine ? t("you") : m.senderUserName} · {format.dateTime(new Date(m.createdAt), { timeStyle: "short" })}
                  {!mine && !m.hidden && actions.report ? <ReportLink messageId={m.id} report={actions.report} /> : null}
                </p>
              </div>
            </div>
          );
        })}
        {seen ? <p className="pr-1 text-right text-[11px] text-muted">{t("seen")}</p> : null}
      </div>

      <form
        className="flex items-end gap-2 border-t border-line bg-white p-2 sm:p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {props.canUploadImages ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              id="chat-image"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
              disabled={uploading || sending}
            />
            <label
              htmlFor="chat-image"
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-canvas"
              title={t("attach")}
              aria-label={t("attach")}
            >
              {uploading ? "…" : "📎"}
            </label>
          </>
        ) : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={uploading ? t("uploading") : t("placeholder")}
          aria-label={t("placeholder")}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-line px-3 py-2.5 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 sm:text-sm"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="h-11 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {t("send")}
        </button>
      </form>
      {error ? <p className="bg-white px-4 pb-2 text-xs text-red-600">{error}</p> : null}
    </Card>
  );
}

function ReportLink({ messageId, report }: { messageId: string; report: NonNullable<ChatThreadActions["report"]> }) {
  const t = useTranslations("chat");
  const [done, setDone] = useState(false);
  if (done) return <span className="ml-1">· ✓</span>;
  return (
    <button
      type="button"
      className="ml-1 hover:underline sm:opacity-0 sm:transition-opacity sm:focus:opacity-100 sm:group-hover:opacity-100"
      onClick={async () => {
        const reason = prompt(t("reportReason"));
        if (!reason) return;
        await report(messageId, reason);
        setDone(true);
        alert(t("reported"));
      }}
    >
      · {t("report")}
    </button>
  );
}
