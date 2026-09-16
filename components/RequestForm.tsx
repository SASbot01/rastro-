"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { translator, type Locale, type Messages } from "@/lib/i18n";

type Status = "idle" | "submitting" | "sent";

const FIELD =
  "w-full rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[16px] text-ink " +
  "placeholder:text-faint transition-colors hover:border-faint focus:border-accent " +
  "focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60";

const LABEL = "block text-[13px] font-medium text-ink";
const HELP = "mt-1.5 text-[12.5px] leading-relaxed text-faint";
const ERROR = "mt-1.5 text-[12.5px] font-medium text-danger";

/**
 * Parte el texto de consentimiento por el marcador {privacy} y coloca
 * el enlace en medio, sin hardcodear el orden de las palabras.
 */
function consentWithLink(template: string, link: ReactNode): ReactNode[] {
  const [before, after = ""] = template.split("{privacy}");
  return [before, link, after];
}

export function RequestForm({ messages, locale }: { messages: Messages; locale: Locale }) {
  const tr = translator(messages);

  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [codeState, setCodeState] = useState<"idle" | "busy">("idle");
  const [codeError, setCodeError] = useState<string | null>(null);

  /** Verificacion por codigo: mismo efecto que abrir el enlace, sin salir de esta pagina. */
  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\D/g, "");
    if (code.length !== 6) {
      setCodeError("formErrors.code");
      return;
    }
    setCodeError(null);
    setCodeState("busy");
    try {
      const res = await fetch("/api/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; id?: string };
      if (res.ok && body.ok && body.id) {
        window.location.href = `/informe/${body.id}`;
        return;
      }
      setCodeError(body.error ?? "formErrors.code");
    } catch {
      setCodeError("formErrors.generic");
    } finally {
      setCodeState("idle");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const data = new FormData(event.currentTarget);
    const payload = {
      firstName: String(data.get("firstName") ?? "").trim(),
      lastName: String(data.get("lastName") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      city: String(data.get("city") ?? "").trim(),
      occupation: String(data.get("occupation") ?? "").trim(),
      consent: data.get("consent") === "on",
      locale,
    };

    // Validacion en cliente: evita un viaje al servidor por un campo vacio.
    const next: Record<string, string> = {};
    if (!payload.firstName) next.firstName = "formErrors.firstName";
    if (!payload.lastName) next.lastName = "formErrors.lastName";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) next.email = "formErrors.email";
    if (!payload.consent) next.consent = "formErrors.consent";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      setFormError(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setStatus("submitting");

    try {
      const response = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok || !body.ok) {
        if (body.fields) setErrors(body.fields);
        setFormError(body.error ?? "formErrors.generic");
        setStatus("idle");
        return;
      }

      setEmail(payload.email);
      setStatus("sent");
    } catch {
      setFormError("formErrors.generic");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <section
        aria-live="polite"
        className="rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(26,26,25,0.04)] sm:p-8"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              d="M3 7.5 12 13l9-5.5M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5Z"
              fill="none"
              stroke="#4dfc5f"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">{tr("sent.title")}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("sent.body", { email })}</p>
        <p className={HELP}>{tr("sent.spam")}</p>
        <p className={HELP}>{tr("sent.expires")}</p>

        <form onSubmit={onCode} noValidate className="mt-6 rounded-[10px] bg-paper p-4">
          <p className="text-[14px] font-semibold text-ink">{tr("sent.codeTitle")}</p>
          <p className="mt-1 text-[13px] text-muted">{tr("sent.codeBody")}</p>
          <div className="mt-3 flex gap-2">
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={tr("sent.codePlaceholder")}
              disabled={codeState === "busy"}
              aria-invalid={Boolean(codeError)}
              className={FIELD + " max-w-[160px] text-center text-[20px] tracking-[0.2em]"}
            />
            <button
              type="submit"
              disabled={codeState === "busy"}
              className="rounded-[10px] bg-accent px-4 py-3 text-[14px] font-semibold text-black hover:opacity-90 disabled:opacity-60"
            >
              {codeState === "busy" ? tr("sent.codeChecking") : tr("sent.codeSubmit")}
            </button>
          </div>
          {codeError && (
            <p role="alert" className={ERROR}>
              {tr(codeError)}
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-5 text-[13px] font-medium text-accent underline underline-offset-4 hover:opacity-80"
        >
          {tr("sent.again")}
        </button>
      </section>
    );
  }

  const busy = status === "submitting";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(26,26,25,0.04)] sm:p-8"
    >
      <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">{tr("form.title")}</h2>
      <p className="mt-1.5 text-[13px] text-faint">{tr("form.onlyYourself")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="firstName">
            {tr("form.firstName")}
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            placeholder={tr("form.firstNamePlaceholder")}
            disabled={busy}
            aria-invalid={Boolean(errors.firstName)}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            className={`mt-1.5 ${FIELD}`}
          />
          {errors.firstName && (
            <p id="firstName-error" className={ERROR}>
              {tr(errors.firstName)}
            </p>
          )}
        </div>

        <div>
          <label className={LABEL} htmlFor="lastName">
            {tr("form.lastName")}
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            placeholder={tr("form.lastNamePlaceholder")}
            disabled={busy}
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
            className={`mt-1.5 ${FIELD}`}
          />
          {errors.lastName && (
            <p id="lastName-error" className={ERROR}>
              {tr(errors.lastName)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className={LABEL} htmlFor="email">
          {tr("form.email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={tr("form.emailPlaceholder")}
          disabled={busy}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : "email-help"}
          className={`mt-1.5 ${FIELD}`}
        />
        {errors.email ? (
          <p id="email-error" className={ERROR}>
            {tr(errors.email)}
          </p>
        ) : (
          <p id="email-help" className={HELP}>
            {tr("form.emailHelp")}
          </p>
        )}
      </div>

      <div className="mt-4">
        <label className={LABEL} htmlFor="city">
          {tr("form.city")}
        </label>
        <input
          id="city"
          name="city"
          type="text"
          autoComplete="address-level2"
          placeholder={tr("form.cityPlaceholder")}
          required
          disabled={busy}
          aria-describedby="city-help"
          className={`mt-1.5 ${FIELD}`}
        />
        <p id="city-help" className={HELP}>
          {tr("form.cityHelp")}
        </p>
      </div>

      <div className="mt-4">
        <label className={LABEL} htmlFor="occupation">
          {tr("form.occupation")}{" "}
          <span className="font-normal text-faint">({tr("form.cityOptional")})</span>
        </label>
        <input
          id="occupation"
          name="occupation"
          type="text"
          autoComplete="organization-title"
          placeholder={tr("form.occupationPlaceholder")}
          disabled={busy}
          aria-describedby="occupation-help"
          className={`mt-1.5 ${FIELD}`}
        />
        <p id="occupation-help" className={HELP}>
          {tr("form.occupationHelp")}
        </p>
      </div>

      <div className="mt-6 rounded-[10px] bg-paper p-4">
        <label htmlFor="consent" className="flex cursor-pointer items-start gap-3">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            disabled={busy}
            aria-invalid={Boolean(errors.consent)}
            className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-accent"
          />
          <span className="text-[13px] leading-relaxed text-muted">
            {consentWithLink(
              tr("form.consent"),
              <a
                key="privacy"
                href="/privacidad"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline underline-offset-2"
                onClick={(event) => event.stopPropagation()}
              >
                {tr("form.consentPrivacyLink")}
              </a>,
            )}
          </span>
        </label>
        {errors.consent && <p className={ERROR}>{tr(errors.consent)}</p>}
      </div>

      {formError && (
        <p role="alert" className="mt-4 text-[13px] font-medium text-danger">
          {tr(formError)}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-[10px] bg-accent px-5 py-3.5 text-[15px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? tr("form.submitting") : tr("form.submit")}
      </button>
    </form>
  );
}
