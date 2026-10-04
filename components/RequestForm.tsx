"use client";

import { readRef } from "@/components/RefCapture";
import { useState, type FormEvent, type ReactNode } from "react";
import { translator, type Locale, type Messages } from "@/lib/i18n";

type Status = "idle" | "submitting" | "sent";

const FIELD = "field";

const LABEL = "label";
const HELP = "mt-2 text-[13px] leading-relaxed text-faint";
const ERROR = "mt-2 flex items-center gap-1.5 text-[13px] font-medium text-danger";

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
      ref: readRef() ?? undefined,
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
        className="card card-glow rise p-6 sm:p-8"
      >
        <div className="pop relative mb-5 flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent-soft shadow-[inset_0_0_0_1px_rgb(77_252_95/0.3)]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
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
        <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-ink">{tr("sent.title")}</h2>
        <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{tr("sent.body", { email })}</p>
        <p className={HELP}>{tr("sent.spam")}</p>
        <p className={HELP}>{tr("sent.expires")}</p>

        <form onSubmit={onCode} noValidate className="mt-6 rounded-[16px] border border-line bg-paper/60 p-4">
          <p className="text-[15px] font-semibold text-ink">{tr("sent.codeTitle")}</p>
          <p className="mt-1 text-[14px] text-muted">{tr("sent.codeBody")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={tr("sent.codePlaceholder")}
              disabled={codeState === "busy"}
              aria-invalid={Boolean(codeError)}
              className={FIELD + " num min-w-0 max-w-[180px] flex-1 text-center !text-[22px] !tracking-[0.25em]"}
            />
            <button
              type="submit"
              disabled={codeState === "busy"}
              className="btn btn-primary"
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
          className="link mt-5 inline-flex min-h-[44px] items-center text-[14px]"
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
      className="card p-6 sm:p-8"
    >
      <h2 className="text-[21px] font-semibold tracking-[-0.025em] text-ink">{tr("form.title")}</h2>
      <p className="mt-1.5 text-[14px] text-muted">{tr("form.onlyYourself")}</p>

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
            className={`mt-2 ${FIELD}`}
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
            className={`mt-2 ${FIELD}`}
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
          className={`mt-2 ${FIELD}`}
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
          className={`mt-2 ${FIELD}`}
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
          className={`mt-2 ${FIELD}`}
        />
        <p id="occupation-help" className={HELP}>
          {tr("form.occupationHelp")}
        </p>
      </div>

      <div className={"mt-6 rounded-[16px] border p-4 transition-colors " + (errors.consent ? "border-danger/60 bg-danger/5" : "border-line bg-paper/60")}>
        <label htmlFor="consent" className="flex cursor-pointer items-start gap-3.5">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            disabled={busy}
            aria-invalid={Boolean(errors.consent)}
            className="mt-0.5 h-[22px] w-[22px] shrink-0 cursor-pointer rounded accent-accent"
          />
          <span className="text-[14px] leading-relaxed text-muted">
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
        <p role="alert" className="mt-4 rounded-[12px] border border-danger/40 bg-danger/10 px-4 py-3 text-[14px] font-medium text-danger">
          {tr(formError)}
        </p>
      )}

      <button type="submit" disabled={busy} aria-busy={busy} className="btn btn-primary btn-lg mt-5 w-full">
        {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" aria-hidden="true" />}
        {busy ? tr("form.submitting") : tr("form.submit")}
        {!busy && (
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </button>
      <p className="mt-3 flex items-start justify-center gap-2 text-center text-[13px] leading-relaxed text-faint">
        <svg viewBox="0 0 20 20" className="mt-[3px] h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true"><path d="M6 9V7a4 4 0 0 1 8 0v2M5 9h10v7H5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {tr("landing.formSecure")}
      </p>
    </form>
  );
}
