"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { translator, type Messages } from "@/lib/i18n";
import type { ReportStep } from "@/lib/report/job";

const POLL_MS = 1500;

interface Props {
  id: string;
  steps: readonly ReportStep[];
  initialStep: ReportStep | null;
  messages: Messages;
}

/**
 * Pagina de espera: consulta el estado cada 1,5 s y, cuando el informe esta
 * listo (o ha fallado), recarga el componente de servidor que lo pinta.
 */
export function ReportWaiting({ id, steps, initialStep, messages }: Props) {
  const tr = translator(messages);
  const router = useRouter();
  const [step, setStep] = useState<ReportStep | null>(initialStep);

  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/report/${id}`, { cache: "no-store" });
        const body = (await res.json()) as { status: string; step: ReportStep | null };
        if (cancelled) return;
        if (body.status === "done" || body.status === "error" || body.status === "not_found") {
          clearInterval(timer);
          router.refresh();
          return;
        }
        setStep(body.step);
      } catch {
        // Un fallo de red puntual no debe romper la espera; se reintenta en el siguiente tick.
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, router]);

  const currentIndex = step ? steps.indexOf(step) : -1;

  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(26,26,25,0.04)] sm:p-8">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
        {tr("waiting.confirmed")}
      </p>
      <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-ink">{tr("waiting.title")}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("waiting.subtitle")}</p>

      <ol className="mt-7 grid gap-3" aria-live="polite">
        {steps.map((s, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "queued";
          return (
            <li key={s} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold " +
                  (state === "done"
                    ? "border-accent bg-accent text-black"
                    : state === "active"
                      ? "border-accent text-accent"
                      : "border-line text-faint")
                }
              >
                {state === "done" ? (
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5">
                    <path d="m5 10.5 3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : state === "active" ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                ) : (
                  i + 1
                )}
              </span>
              <span className={"text-[14px] " + (state === "queued" ? "text-faint" : "text-ink")}>
                {tr(`waiting.step.${s}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
