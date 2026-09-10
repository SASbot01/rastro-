"use client";

import { useState, type FormEvent } from "react";
import { translator, type Locale, type Messages } from "@/lib/i18n";

const FIELD =
  "w-full rounded-[12px] border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-ink " +
  "placeholder:text-faint transition-colors hover:border-faint focus:border-accent focus:outline-none disabled:opacity-60";
const LABEL = "block text-[13px] font-medium text-ink";

export function SupportForm({ messages, locale, email, page }: { messages: Messages; locale: Locale; email: string | null; page: string | null }) {
  const tr = translator(messages);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? "").trim(),
          subject: String(data.get("subject") ?? "").trim(),
          message: String(data.get("message") ?? "").trim(),
          page: page ?? undefined,
          locale,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; email?: string };
      if (res.ok && body.ok) setSentTo(body.email ?? null);
      else setError(body.error ?? "formErrors.generic");
    } catch {
      setError("formErrors.generic");
    } finally {
      setBusy(false);
    }
  }

  const card = "rounded-card border border-line bg-surface p-6 sm:p-8";

  if (sentTo) {
    return (
      <section aria-live="polite" className={card}>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{tr("support.sentTitle")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("support.sentBody", { email: sentTo })}</p>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={card}>
      <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-ink">{tr("support.title")}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("support.subtitle")}</p>

      <div className="mt-6 grid gap-4">
        <div>
          <label className={LABEL} htmlFor="support-email">{tr("support.email")}</label>
          <input id="support-email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={email ?? ""} readOnly={Boolean(email)} disabled={busy} className={`mt-1.5 ${FIELD} ${email ? "opacity-70" : ""}`} placeholder={tr("form.emailPlaceholder")} />
        </div>
        <div>
          <label className={LABEL} htmlFor="support-subject">{tr("support.subject")}</label>
          <input id="support-subject" name="subject" type="text" maxLength={120} disabled={busy} className={`mt-1.5 ${FIELD}`} placeholder={tr("support.subjectPlaceholder")} />
        </div>
        <div>
          <label className={LABEL} htmlFor="support-message">{tr("support.message")}</label>
          <textarea id="support-message" name="message" rows={6} maxLength={4000} disabled={busy} className={`mt-1.5 ${FIELD} resize-y`} placeholder={tr("support.messagePlaceholder")} />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] font-medium text-danger">
          {tr(error)}
        </p>
      )}

      <button type="submit" disabled={busy} className="mt-5 w-full rounded-[12px] bg-accent px-5 py-3.5 text-[15px] font-semibold text-black hover:opacity-90 disabled:opacity-60">
        {busy ? tr("support.sending") : tr("support.send")}
      </button>
    </form>
  );
}
