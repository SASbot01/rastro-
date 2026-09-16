"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { translator, type Locale, type Messages } from "@/lib/i18n";
import type { GuardianVerdict } from "@/lib/ai/guardian";

const FIELD = "w-full rounded-[12px] border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-faint focus:border-accent focus:outline-none disabled:opacity-60";
const VERDICT = { scam: "bg-danger/15 text-danger", suspicious: "bg-warn/15 text-warn", legit: "bg-accent-soft text-accent" } as const;

/** Formulario del guardian: pega el mensaje, recibe el veredicto. */
export function GuardianForm({ messages, locale, personalized }: { messages: Messages; locale: Locale; personalized: boolean }) {
  const tr = translator(messages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuardianVerdict | null>(null);
  const [text, setText] = useState("");
  const [sender, setSender] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/guardian", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: String(data.get("text") ?? ""), sender: String(data.get("sender") ?? ""), locale }) });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; verdict?: GuardianVerdict; error?: string };
      if (res.ok && body.ok && body.verdict) setResult(body.verdict);
      else setError(body.error ?? "guardian.errors.generic");
    } catch {
      setError("guardian.errors.generic");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={onSubmit} className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><button type="button" disabled={busy} className="ex-text-link" onClick={() => { setText(tr("experience.guardianSampleText")); setSender(""); setResult(null); setError(null); }}>{tr("experience.guardianSample")}</button><Link className="ex-emergency-link" href="/ayuda-urgente">{tr("experience.emergency")} ↗</Link></div>
        <label className="block text-[13px] font-medium text-ink" htmlFor="g-sender">{tr("guardian.sender")}</label>
        <input id="g-sender" name="sender" value={sender} onChange={(e) => setSender(e.target.value)} maxLength={200} disabled={busy} placeholder={tr("guardian.senderPlaceholder")} className={"mt-1.5 " + FIELD} />
        <label className="mt-4 block text-[13px] font-medium text-ink" htmlFor="g-text">{tr("guardian.text")}</label>
        <textarea id="g-text" name="text" value={text} onChange={(e) => setText(e.target.value)} aria-describedby="guardian-counter" rows={7} maxLength={4000} required disabled={busy} placeholder={tr("guardian.textPlaceholder")} className={"mt-1.5 resize-y " + FIELD} />
        <p id="guardian-counter" className="ex-note mt-2 text-right">{tr("experience.guardianCount", { n: text.length })}</p>
        <p className="mt-2 text-[12px] text-faint">{personalized ? tr("guardian.personalized") : tr("guardian.notPersonalized")}</p>
        {error && <p role="alert" className="mt-3 text-[13px] font-medium text-danger">{tr(error)}</p>}
        <button type="submit" disabled={busy} className="mt-4 rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90 disabled:opacity-60">{busy ? tr("guardian.analyzing") : tr("guardian.analyze")}</button>
        {(text || sender || result) && <button type="button" disabled={busy} className="ex-quiet ml-3" onClick={() => { setText(""); setSender(""); setResult(null); setError(null); }}>{tr("experience.guardianClear")}</button>}
      </form>

      {result && (
        <section aria-live="polite" className="rounded-card border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={"rounded-full px-3 py-1 text-[12.5px] font-semibold uppercase tracking-wide " + VERDICT[result.verdict]}>{tr(`guardian.verdict.${result.verdict}`)}</span>
            <span className="text-[12.5px] text-faint">{tr("guardian.confidence", { n: result.confidence })}</span>
          </div>
          <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-ink">{result.headline}</h2>
          <ul className="mt-3 grid gap-1.5">
            {result.reasons.map((r) => <li key={r} className="flex gap-2 text-[14px] leading-relaxed text-muted"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />{r}</li>)}
          </ul>
          {result.uses_your_data.length > 0 && (
            <div className="mt-4 rounded-[12px] bg-surface-2 p-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-danger">{tr("guardian.usesData")}</p>
              <ul className="mt-1 grid gap-1">{result.uses_your_data.map((d) => <li key={d} className="text-[13.5px] text-ink">· {d}</li>)}</ul>
            </div>
          )}
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("guardian.actions")}</p>
          <ol className="mt-1 grid gap-1.5">
            {result.actions.map((a, i) => <li key={a} className="flex gap-2.5 text-[14px] leading-relaxed text-ink"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-black">{i + 1}</span>{a}</li>)}
          </ol>
          {result.verify_how && <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{tr("guardian.verifyHow")}: {result.verify_how}</p>}
          <p className="mt-4 text-[11.5px] text-faint">{tr("guardian.disclaimer")}</p>
        </section>
      )}
    </div>
  );
}
