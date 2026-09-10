"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { translator, type Locale, type Messages } from "@/lib/i18n";

const FIELD =
  "w-full rounded-[12px] border border-line bg-surface-2 px-3.5 py-3 text-[16px] text-ink " +
  "placeholder:text-faint transition-colors hover:border-faint focus:border-accent " +
  "focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60";

/**
 * Entrar / crear cuenta: "Continuar con Google" (un toque) o correo con
 * codigo de 6 digitos. Sin contrasenas. La misma pantalla sirve para
 * registrarse: la cuenta se crea al verificar el correo.
 */
export function LoginForm({ messages, locale, googleEnabled }: { messages: Messages; locale: Locale; googleEnabled: boolean }) {
  const tr = translator(messages);
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("formErrors.email");
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, locale }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) return setError(body.error ?? "formErrors.generic");
      setEmail(value);
      setStep("code");
    } catch {
      setError("formErrors.generic");
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\D/g, "");
    if (code.length !== 6) return setError("formErrors.code");
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/login/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && body.ok) {
        window.location.href = "/cuenta";
        return;
      }
      setError(body.error ?? "formErrors.code");
    } catch {
      setError("formErrors.generic");
    } finally {
      setBusy(false);
    }
  }

  const card = "rounded-card border border-line bg-surface p-6 sm:p-8";

  if (step === "code") {
    return (
      <form onSubmit={checkCode} noValidate className={card} aria-live="polite">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("login.codeEyebrow")}</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">{tr("login.codeTitle")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("login.codeBody", { email })}</p>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus
          placeholder={tr("sent.codePlaceholder")}
          disabled={busy}
          aria-invalid={Boolean(error)}
          className={`mt-5 ${FIELD} text-center text-[24px] tracking-[0.3em]`}
        />
        {error && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-danger">
            {tr(error)}
          </p>
        )}
        <button type="submit" disabled={busy} className="mt-4 w-full rounded-[12px] bg-accent px-5 py-3.5 text-[15px] font-semibold text-black hover:opacity-90 disabled:opacity-60">
          {busy ? tr("sent.codeChecking") : tr("login.codeSubmit")}
        </button>
        <p className="mt-4 text-[12.5px] text-faint">{tr("login.codeLink")}</p>
        <button type="button" onClick={() => setStep("email")} className="mt-3 text-[13px] font-medium text-muted underline underline-offset-4 hover:text-ink">
          {tr("sent.again")}
        </button>
      </form>
    );
  }

  return (
    <div className={card}>
      <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-ink">{tr("login.title")}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("login.subtitle")}</p>

      {googleEnabled && (
        <form action="/api/auth/google/start" method="post" className="mt-6">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-[12px] border border-line bg-surface-2 px-5 py-3.5 text-[15px] font-semibold text-ink hover:border-faint"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.3v3.1A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
            </svg>
            {tr("login.google")}
          </button>
          <p className="mt-2 text-center text-[12px] text-faint">{tr("login.googleNote")}</p>
        </form>
      )}

      {googleEnabled ? (
        <div className="my-6 flex items-center gap-3 text-[12px] uppercase tracking-wide text-faint">
          <span className="h-px flex-1 bg-line" />
          {tr("login.or")}
          <span className="h-px flex-1 bg-line" />
        </div>
      ) : (
        <div className="mt-6" />
      )}

      <form onSubmit={sendCode} noValidate>
        <label className="block text-[13px] font-medium text-ink" htmlFor="login-email">
          {tr("login.email")}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={tr("form.emailPlaceholder")}
          disabled={busy}
          aria-invalid={Boolean(error)}
          className={`mt-1.5 ${FIELD}`}
        />
        {error && (
          <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-danger">
            {tr(error)}
          </p>
        )}
        <button type="submit" disabled={busy} className="mt-4 w-full rounded-[12px] bg-accent px-5 py-3.5 text-[15px] font-semibold text-black hover:opacity-90 disabled:opacity-60">
          {busy ? tr("login.submitting") : tr("login.submitCode")}
        </button>
        <p className="mt-3 text-[12.5px] leading-relaxed text-faint">{tr("login.noPassword")}</p>
      </form>

      <p className="mt-6 text-[13px] text-faint">
        {tr("login.noAccount")}{" "}
        <Link href="/#form" className="font-medium text-accent underline underline-offset-4">
          {tr("login.noAccountCta")}
        </Link>
      </p>
    </div>
  );
}
