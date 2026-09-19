"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ScoreRing } from "@/components/experience/ScoreRing";
import { translator, type Messages } from "@/lib/i18n";
import type { ReportProgress, ReportStep } from "@/lib/report/job";

const POLL_MS = 1500;

interface Props {
  id: string;
  steps: readonly ReportStep[];
  initialStep: ReportStep | null;
  messages: Messages;
}

type Tone = "ok" | "warn" | "bad";
const TONE_TILE: Record<Tone, string> = {
  ok: "bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgb(77_252_95/0.25)]",
  warn: "bg-warn/12 text-warn shadow-[inset_0_0_0_1px_rgb(255_176_32/0.28)]",
  bad: "bg-danger/12 text-danger shadow-[inset_0_0_0_1px_rgb(255_95_95/0.3)]",
};

function ToneIcon({ tone }: { tone: Tone }) {
  return (
    <span className={"pop flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] " + TONE_TILE[tone]} aria-hidden="true">
      <svg viewBox="0 0 20 20" className="h-4 w-4">
        {tone === "ok" ? (
          <path d="m5 10.5 3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M10 5v6M10 14.5v.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}

/**
 * Pagina de espera: consulta el estado cada 1,5 s y, cuando el informe esta
 * listo (o ha fallado), recarga el componente de servidor que lo pinta.
 * Lo que va llegando (filtraciones, resultados, sitios, asistentes, nota
 * provisional) entra de uno en uno; el hueco de cada fuente esta reservado
 * con un esqueleto para que nada salte.
 */
export function ReportWaiting({ id, steps, initialStep, messages }: Props) {
  const tr = translator(messages);
  const router = useRouter();
  const [step, setStep] = useState<ReportStep | null>(initialStep);
  const [progress, setProgress] = useState<ReportProgress | null>(null);
  const seen = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const timer = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(`/api/report/${id}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const body = (await res.json()) as { status: string; step: ReportStep | null; progress?: ReportProgress | null };
        if (cancelled) return;
        if (body.status === "done" || body.status === "error" || body.status === "not_found") {
          clearInterval(timer);
          if (body.status === "done") router.replace(`/informe/${id}?reveal=1`);
          else router.refresh();
          return;
        }
        setStep(body.step);
        if (body.progress) setProgress(body.progress);
      } catch {
        // Un fallo de red puntual no debe romper la espera; se reintenta en el siguiente tick.
      } finally {
        inFlight = false;
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, router]);

  // Las fuentes corren a la vez: un paso esta hecho cuando su dato ya ha llegado, no por orden.
  const p = progress ?? {};
  const arrived: Record<string, boolean> = { hibp: p.breaches !== undefined, brave: p.results !== undefined && p.sites !== undefined, ai: false, report: false };
  const currentIndex = step ? steps.indexOf(step) : -1;
  const states = steps.map((s, i) => (arrived[s] || i < currentIndex ? "done" : i === currentIndex || (currentIndex >= 0 && !arrived[s] && i < 2) ? "active" : "queued"));
  const doneCount = states.filter((s) => s === "done").length;

  // Un hueco por fuente: undefined = aun buscando (esqueleto), null = la fuente fallo (no se pinta).
  const slots: Array<{ key: string; pending: boolean; tone?: Tone; text?: string }> = [
    { key: "b", pending: p.breaches === undefined, ...(p.breaches ? (p.breaches.total === 0 ? { tone: "ok" as const, text: tr("waiting.live.noBreaches") } : { tone: p.breaches.withPassword > 0 ? ("bad" as const) : ("warn" as const), text: tr("waiting.live.breaches", { n: p.breaches.total, names: p.breaches.names.slice(0, 3).join(", ") }) }) : {}) },
    { key: "r", pending: p.results === undefined, ...(p.results ? { tone: p.results.profiles > 0 ? ("warn" as const) : ("ok" as const), text: tr("waiting.live.results", { n: p.results.total, profiles: p.results.profiles }) } : {}) },
    { key: "s", pending: p.sites === undefined, ...(p.sites ? (p.sites.listed.length === 0 ? { tone: "ok" as const, text: tr("waiting.live.noSites", { n: p.sites.checked }) } : { tone: "bad" as const, text: tr("waiting.live.sites", { n: p.sites.listed.length, total: p.sites.checked, names: p.sites.listed.slice(0, 3).join(", ") }) }) : {}) },
    { key: "a", pending: !p.assistants?.length, ...(p.assistants?.length ? { tone: "ok" as const, text: tr("waiting.live.assistants", { names: [...new Set(p.assistants)].map((a) => tr(`aiWatch.providers.${a}`)).join(", ") }) } : {}) },
  ];
  const found = slots.filter((s) => s.text).length;
  const hasPrelim = typeof p.prelimScore === "number";

  // Toque corto al llegar algo nuevo (solo moviles que lo soportan y sin "reducir movimiento").
  useEffect(() => {
    if (found > seen.current && typeof navigator !== "undefined" && "vibrate" in navigator && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try { navigator.vibrate(12); } catch { /* sin permiso: da igual */ }
    }
    seen.current = found;
  }, [found]);

  return (
    <div className="card card-glow rise mx-auto max-w-[620px] p-6 sm:p-9">
      {/* Escaner: radar mientras se busca; en cuanto hay nota provisional, el anillo. */}
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-[168px] w-[168px] items-center justify-center">
          {hasPrelim ? (
            <div className="pop">
              <ScoreRing key={p.prelimScore} score={p.prelimScore as number} label={tr("waiting.live.prelimLabel")} size={160} />
            </div>
          ) : (
            <>
              <span className="radar-ring absolute inset-0 rounded-full" aria-hidden="true" />
              <span className="absolute inset-[3px] rounded-full bg-surface" aria-hidden="true" />
              <span className="absolute inset-[18px] rounded-full border border-dashed border-line-strong" aria-hidden="true" />
              <span className="radar-ping absolute inset-[30px] rounded-full border border-accent/40" aria-hidden="true" />
              <img src="/brand/mascot-192.png" alt="" width={96} height={96} className="breathe relative h-24 w-24 rounded-full border border-line-strong object-cover" />
            </>
          )}
        </div>
        {hasPrelim && (
          <p className="fade-in mt-1 max-w-[36ch] text-[13px] leading-relaxed text-faint">
            <span className="font-semibold text-muted">{tr("waiting.live.prelimLabel")}.</span> {tr("waiting.live.prelimNote")}
          </p>
        )}

        <p className="chip tone-ok mt-5 !font-semibold">
          <span className="dot dot-live" aria-hidden="true" />
          {tr("waiting.confirmed")}
        </p>
        <h1 className="h1 mt-4 text-ink">{tr("waiting.title")}</h1>
        <p className="lead mt-2 max-w-[40ch] !text-[15.5px]">{tr("waiting.subtitle")}</p>
      </div>

      {/* Progreso global */}
      <div className="mt-7">
        <div className="flex items-center justify-between text-[12.5px] text-faint">
          <span className="tabular-nums">{tr("waiting.progress", { done: doneCount, total: steps.length })}</span>
          <span className="inline-flex items-center gap-1.5 text-accent"><span className="dot dot-live !h-1.5 !w-1.5" aria-hidden="true" />{tr("waiting.searching")}</span>
        </div>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label={tr("waiting.title")}>
          <span className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${Math.max(8, (doneCount / steps.length) * 100)}%` }} />
          <span className="skeleton absolute inset-0 !rounded-full opacity-70" aria-hidden="true" />
        </div>
      </div>

      {/* Hallazgos en vivo */}
      <div className="mt-6">
        <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">
          {tr("waiting.live.title")}
          {found > 0 && <span className="badge tone-ok tabular-nums">{found}</span>}
        </p>
        <ul className="mt-3 grid gap-2" aria-live="polite">
          {slots.map((slot, i) =>
            slot.text && slot.tone ? (
              <li key={slot.key} className="rise tile flex items-start gap-3 px-3.5 py-3 text-[14.5px] leading-relaxed text-ink" style={{ "--i": Math.min(i, 2) } as CSSProperties}>
                <ToneIcon tone={slot.tone} />
                <span className="min-w-0 pt-[3px]">{slot.text}</span>
              </li>
            ) : slot.pending ? (
              <li key={slot.key} aria-hidden="true" className="tile flex items-center gap-3 px-3.5 py-3">
                <span className="skeleton h-8 w-8 shrink-0 !rounded-[10px]" />
                <span className="grid flex-1 gap-1.5">
                  <span className="skeleton h-2.5 w-[86%]" />
                  <span className="skeleton h-2.5 w-[58%]" />
                </span>
              </li>
            ) : null,
          )}
        </ul>
      </div>
      <ol className="mt-6 grid gap-1 border-t border-line pt-4" aria-live="polite">
        {steps.map((s, i) => {
          const state = states[i];
          return (
            <li key={s} className={"flex min-h-[44px] items-center gap-3 rounded-[12px] px-2 py-1.5 transition-colors " + (state === "active" ? "bg-surface-2/70" : "")}>
              <span
                aria-hidden="true"
                className={
                  "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold " +
                  (state === "done" ? "border-accent bg-accent text-black" : state === "active" ? "border-transparent text-accent" : "border-line-strong text-faint")
                }
              >
                {state === "done" ? (
                  <svg viewBox="0 0 20 20" className="pop h-3.5 w-3.5">
                    <path d="m5 10.5 3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : state === "active" ? (
                  <>
                    <span className="absolute inset-0 animate-spin rounded-full border-2 border-accent/20 border-t-accent [animation-duration:1.1s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  </>
                ) : (
                  i + 1
                )}
              </span>
              <span className={"text-[14.5px] leading-snug " + (state === "queued" ? "text-faint" : state === "done" ? "text-muted" : "font-medium text-ink")}>{tr(`waiting.step.${s}`)}</span>
            </li>
          );
        })}
      </ol>

    </div>
  );
}
