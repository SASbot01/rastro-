"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { translator, type Locale, type Messages } from "@/lib/i18n";

const POLL_MS = 3000;

interface Msg {
  id: number;
  alias: string;
  body: string;
  created_at: string;
  mine: boolean;
}

/**
 * Chat global de la comunidad. Lectura sin sesion; escritura con sesion y
 * alias. Sondeo cada 3 s de los mensajes nuevos (sin websockets: sencillo
 * y suficiente para una sala).
 */
export function CommunityChat({ initial, canWrite, hasAlias, locale, messages }: { initial: Msg[]; canWrite: boolean; hasAlias: boolean; locale: Locale; messages: Messages }) {
  const tr = translator(messages);
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/chat?after=${lastId}`, { cache: "no-store" });
        const b = (await r.json()) as { messages: Msg[] };
        if (b.messages.length) setMsgs((m) => [...m, ...b.messages.filter((x) => !m.some((y) => y.id === x.id))]);
      } catch {
        /* siguiente tick */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [lastId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs.length]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: Msg };
      if (r.ok && b.ok && b.message) {
        setMsgs((m) => [...m, b.message!]);
        form.reset();
      } else {
        setError(b.error ?? "formErrors.generic");
      }
    } catch {
      setError("formErrors.generic");
    } finally {
      setBusy(false);
    }
  }

  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const today = new Date().toDateString();

  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[420px] flex-col rounded-card border border-line bg-surface">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && <p className="py-10 text-center text-[14px] text-faint">{tr("community.empty")}</p>}
        {msgs.map((m) => {
          const d = new Date(m.created_at);
          return (
            <div key={m.id} className={"flex " + (m.mine ? "justify-end" : "justify-start")}>
              <div className={"max-w-[85%] rounded-[16px] px-3.5 py-2.5 " + (m.mine ? "bg-accent text-black" : "bg-surface-2 text-ink")}>
                <p className={"text-[11.5px] font-semibold " + (m.mine ? "text-black/70" : "text-accent")}>
                  {m.mine ? tr("community.you") : m.alias}
                  <span className={"ml-2 font-normal " + (m.mine ? "text-black/50" : "text-faint")}>
                    {d.toDateString() === today ? time.format(d) : `${day.format(d)} ${time.format(d)}`}
                  </span>
                </p>
                <p className="mt-0.5 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-line p-3">
        {!canWrite ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
            <p className="text-[13px] text-muted">{tr("community.loginBody")}</p>
            <Link href="/entrar" className="rounded-[12px] bg-accent px-4 py-2 text-[14px] font-semibold text-black hover:opacity-90">{tr("nav.login")}</Link>
          </div>
        ) : !hasAlias ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
            <p className="text-[13px] text-muted">{tr("community.aliasNeeded")}</p>
            <Link href="/cuenta" className="rounded-[12px] bg-accent px-4 py-2 text-[14px] font-semibold text-black hover:opacity-90">{tr("community.aliasSave")}</Link>
          </div>
        ) : (
          <form onSubmit={send} className="flex items-end gap-2">
            <textarea
              name="body"
              rows={1}
              maxLength={500}
              placeholder={tr("community.placeholder")}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              className="min-h-[44px] flex-1 resize-none rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
            />
            <button type="submit" disabled={busy} className="h-[44px] rounded-[12px] bg-accent px-4 text-[14px] font-semibold text-black hover:opacity-90 disabled:opacity-60">
              {tr("community.send")}
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-2 px-1 text-[12.5px] text-danger">
            {tr(error)}
          </p>
        )}
      </div>
    </div>
  );
}
