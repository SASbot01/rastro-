"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { translator, type Locale, type Messages } from "@/lib/i18n";

interface Msg { role: "user" | "assistant"; content: string }

/**
 * El muneco de Rastro: boton flotante con el avatar que abre un chat corto
 * sobre el producto (/api/ask). Se abre tambien desde la portada con el
 * evento "rastro:ask" (la burbuja junto al muneco grande).
 */
export function AskRastro({ messages, locale }: { messages: Messages; locale: Locale }) {
  const tr = translator(messages);
  const suggested = messages.ask.suggested as string[];
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // El evento "rastro:ask" abre el panel y, si trae una pregunta (chips del panel de inicio), la lanza.
  const askRef = useRef<(q: string) => Promise<void>>(async () => {});
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<string>).detail;
      if (typeof q === "string" && q.trim()) void askRef.current(q);
    };
    window.addEventListener("rastro:ask", onOpen);
    return () => window.removeEventListener("rastro:ask", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    inputRef.current?.focus();
  }, [open, thread, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setText("");
    const next: Msg[] = [...thread, { role: "user", content: q }];
    setThread(next);
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, locale, history: thread.slice(-6) }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; answer?: string; error?: string };
      if (res.ok && body.ok && body.answer) setThread([...next, { role: "assistant", content: body.answer }]);
      else setError(body.error ?? "ask.error");
    } catch {
      setError("ask.error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    askRef.current = ask;
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void ask(text);
  }

  return (
    <>
      {/* Boton flotante: encima de la barra inferior en movil */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={tr("ask.open")}
        aria-expanded={open}
        className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-accent bg-surface shadow-[0_8px_30px_rgba(0,0,0,0.55),0_0_24px_-6px_rgb(77_252_95/0.6)] transition-transform duration-200 hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6"
      >
        <img src="/brand/mascot-112.png" alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-full object-cover" />
        {!open && <span aria-hidden="true" className="radar-ping absolute inset-0 rounded-full border border-accent/70 [animation-iteration-count:3]" />}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label={tr("ask.title")}
          className="card rise fixed inset-x-3 bottom-[calc(142px+env(safe-area-inset-bottom))] z-40 flex max-h-[min(70dvh,560px)] flex-col overflow-hidden !border-line-strong shadow-[0_16px_50px_rgba(0,0,0,0.6)] [animation-duration:0.3s] sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[380px]"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <img src="/brand/mascot-112.png" alt="" width={36} height={36} className="h-9 w-9 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink">{tr("ask.title")}</p>
              <p className="truncate text-[12px] text-faint">{tr("ask.subtitle")}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={tr("ask.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
            {thread.length === 0 && (
              <ul className="grid gap-2">
                {suggested.map((q) => (
                  <li key={q}>
                    <button type="button" onClick={() => void ask(q)} className="min-h-[44px] w-full rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-left text-[14.5px] text-ink transition-colors hover:border-accent/60">
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <ul className="grid gap-2.5">
              {thread.map((m, i) => (
                <li key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <p className={"rise max-w-[85%] whitespace-pre-line px-3.5 py-2.5 text-[14.5px] leading-relaxed [animation-duration:0.3s] " + (m.role === "user" ? "rounded-[16px_16px_4px_16px] bg-accent text-[#04210a]" : "rounded-[4px_16px_16px_16px] bg-surface-2 text-ink")}>{m.content}</p>
                </li>
              ))}
              {busy && (
                <li className="flex justify-start">
                  <p className="flex items-center gap-2 rounded-[4px_16px_16px_16px] bg-surface-2 px-3.5 py-2.5 text-[14px] text-faint"><span className="flex gap-1" aria-hidden="true">{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${d * 120}ms` }} />)}</span>{tr("ask.thinking")}</p>
                </li>
              )}
              {error && (
                <li>
                  <p role="alert" className="text-[13px] text-danger">{tr(error)}</p>
                </li>
              )}
            </ul>
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line p-3">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              disabled={busy}
              placeholder={tr("ask.placeholder")}
              className="field !min-h-[44px] min-w-0 flex-1 !rounded-[12px] !py-2"
            />
            <button type="submit" disabled={busy || !text.trim()} className="btn btn-primary btn-sm">
              {tr("ask.send")}
            </button>
          </form>
          <p className="border-t border-line px-4 py-2 text-[11px] text-faint">{tr("ask.disclaimer")}</p>
        </section>
      )}
    </>
  );
}
