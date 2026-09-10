"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { translator, type Locale, type Messages } from "@/lib/i18n";

const FIELD =
  "w-full rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[16px] text-ink " +
  "placeholder:text-faint transition-colors hover:border-faint focus:border-accent " +
  "focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60";

/** Formulario de acceso: solo correo. Siempre responde igual, exista o no la cuenta. */
export function LoginForm({ messages, locale }: { messages: Messages; locale: Locale }) {
  const tr = translator(messages);
  const [status, setStatus] = useState<"idle" | "busy" | "sent">("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("formErrors.email");
      return;
    }
    setError(null);
    setStatus("busy");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, locale }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "formErrors.generic");
        setStatus("idle");
        return;
      }
      setEmail(value);
      setStatus("sent");
    } catch {
      setError("formErrors.generic");
      setStatus("idle");
    }
  }

  const card = "rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(26,26,25,0.04)] sm:p-8";

  if (status === "sent") {
    return (
      <section aria-live="polite" className={card}>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{tr("login.sentTitle")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("login.sentBody", { email })}</p>
        <p className="mt-3 text-[12.5px] text-faint">{tr("sent.spam")}</p>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={card}>
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{tr("login.title")}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("login.subtitle")}</p>

      <label className="mt-6 block text-[13px] font-medium text-ink" htmlFor="login-email">
        {tr("login.email")}
      </label>
      <input
        id="login-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={tr("form.emailPlaceholder")}
        disabled={status === "busy"}
        aria-invalid={Boolean(error)}
        className={`mt-1.5 ${FIELD}`}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-danger">
          {tr(error)}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "busy"}
        className="mt-5 w-full rounded-[10px] bg-accent px-5 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {status === "busy" ? tr("login.submitting") : tr("login.submit")}
      </button>

      <p className="mt-5 text-[13px] text-faint">
        {tr("login.noAccount")}{" "}
        <Link href="/#form" className="font-medium text-accent underline underline-offset-4">
          {tr("login.noAccountCta")}
        </Link>
      </p>
    </form>
  );
}
