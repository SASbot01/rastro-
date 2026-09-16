import Link from "next/link";
import { ReportExperience } from "@/components/experience/ReportExperience";
import { brokerForHost } from "@/lib/brokers/catalog";
import { AI_RECTIFY } from "@/lib/assistants";
import { ShareButton } from "@/components/ShareButton";
import { translator, type Locale, type Messages } from "@/lib/i18n";
import { levelFor, type Level } from "@/lib/report/score";
import type { Action, Category, Finding, Severity } from "@/lib/report/findings";
import type { KnownAccount } from "@/lib/report/accounts";

/**
 * Visor del informe. Arriba lo importante (puntuacion, resumen, compartir,
 * acciones); debajo, todo lo demas plegado: cada categoria es un
 * desplegable con su contador, dentro solo el nombre de cada sitio, y al
 * pinchar se abre la explicacion, la fuente y la carta. Sin JavaScript:
 * <details>/<summary> nativos.
 */

export interface ReportData {
  score: number;
  summary: string;
  findings: Finding[];
  actions: Action[];
  created_at: string;
  generator: "ai" | "template";
  accounts?: KnownAccount[];
  assistants?: AssistantView[];
}

export interface AssistantView {
  provider: "perplexity" | "openai" | "gemini";
  answer: string;
  sources: Array<{ title: string; url: string }>;
  status: "ok" | "failed" | "skipped";
}

const CATEGORY_ORDER: Category[] = ["breaches", "ai", "profiles", "false"];

const LEVEL_TEXT: Record<Level, string> = { green: "text-ok", orange: "text-warn", red: "text-danger" };
const LEVEL_STROKE: Record<Level, string> = { green: "#4dfc5f", orange: "#ffb020", red: "#ff5f5f" };

const SEVERITY_DOT: Record<Severity, string> = {
  high: "bg-danger",
  medium: "bg-warn",
  low: "bg-muted",
  info: "bg-faint",
};

const CARD = "rounded-card border border-line bg-surface";

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function Chevron({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 20 20" className={"h-4 w-4 shrink-0 text-faint transition-transform " + cls} aria-hidden="true">
      <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Anillo de score: SVG puro, sin dependencias. */
function ScoreRing({ score, level, label }: { score: number; level: Level; label: string }) {
  const size = 148;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  return (
    <div className="relative h-[148px] w-[148px] shrink-0" role="img" aria-label={`${score}/100 — ${label}`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#262626" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LEVEL_STROKE[level]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={"text-[44px] leading-none font-semibold tracking-[-0.04em] " + LEVEL_TEXT[level]}>{score}</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">/100</span>
      </div>
    </div>
  );
}

export function ReportView({
  report,
  requestId,
  fullName,
  locale,
  messages,
  partial,
  pro,
  reveal,
}: {
  report: ReportData;
  requestId: string;
  fullName: string;
  locale: Locale;
  messages: Messages;
  /** Aviso de version sin IA (plantillas de respaldo). */
  partial?: boolean;
  /** Plan Pro activo: habilita las cartas de supresion. */
  pro?: boolean;
  reveal?: boolean;
}) {
  const tr = translator(messages);
  const level = levelFor(report.score);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(report.created_at));

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: report.findings.map((f, index) => ({ f, index })).filter(({ f }) => f.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <ReportExperience report={report} requestId={requestId} fullName={fullName} locale={locale} messages={messages} pro={pro} reveal={reveal}>
    <article className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* Columna fija: puntuacion + compartir + acciones */}
      <div className="grid gap-4 lg:sticky lg:top-20">
        <section className={CARD + " p-6 sm:p-8"}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("report.eyebrow")}</p>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
              Rastro
            </span>
          </div>
          <div className="mt-6 flex items-center gap-6">
            <ScoreRing score={report.score} level={level} label={tr(`report.level.${level}`)} />
            <div className="min-w-0">
              <p className={"text-[20px] leading-tight font-semibold tracking-[-0.02em] " + LEVEL_TEXT[level]}>{tr(`report.level.${level}`)}</p>
              <p className="mt-1 text-[13px] text-faint">{tr("report.scoreLabel")}</p>
              <p className="mt-3 truncate text-[14px] text-muted">{tr("report.for", { name: fullName })}</p>
              <p className="text-[12.5px] text-faint">{date}</p>
            </div>
          </div>
          <p className="mt-6 text-[15.5px] leading-[1.65] text-ink">{report.summary}</p>
          <p className="mt-3 text-[12.5px] text-faint">{tr("report.scoreHint")}</p>
          {partial && <p className="mt-2 text-[12.5px] leading-relaxed text-faint">{tr("report.partial")}</p>}
        </section>

        <ShareButton requestId={requestId} score={report.score} messages={messages} />

        {report.actions.length > 0 && (
          <section className={CARD + " border-accent/30 p-5 sm:p-6"}>
            <h3 className="text-[15px] font-semibold text-ink">{tr("report.actionsTitle")}</h3>
            <ol className="mt-4 grid gap-4">
              {report.actions.map((a, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-black">
                    {i + 1}
                  </span>
                  <div>
                    <h4 className="text-[15px] font-semibold text-ink">{a.title}</h4>
                    <p className="mt-0.5 text-[14px] leading-[1.6] text-muted">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {/* Columna plegable: cuentas y hallazgos */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">
            {report.findings.length === 1 ? tr("report.countOne") : tr("report.counts", { n: report.findings.length })}
          </h2>
          <p className="text-[12.5px] text-faint">{tr("report.whatYouSee")}</p>
        </div>

        {report.accounts && report.accounts.length > 0 && (
          <details className={"group min-w-0 overflow-hidden " + CARD}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                {tr("report.accountsTitle")}
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{report.accounts.length}</span>
              </span>
              <Chevron cls="group-open:rotate-180" />
            </summary>
            <div className="border-t border-line px-5 pt-3 pb-4">
              <p className="text-[13px] leading-relaxed text-muted">{tr("report.accountsHint")}</p>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {report.accounts.map((a) => (
                  <li key={(a.domain ?? a.name) + a.source} className="flex items-center justify-between gap-3 rounded-[12px] bg-surface-2 px-3.5 py-2.5">
                    <div className="min-w-0">
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer nofollow" className="block truncate text-[14px] font-semibold text-ink underline-offset-4 hover:underline">
                          {a.name}
                        </a>
                      ) : (
                        <p className="truncate text-[14px] font-semibold text-ink">{a.name}</p>
                      )}
                      <p className="text-[12px] text-faint">
                        {a.source === "breach" ? tr("report.accountBreach", { year: (a.date ?? "").slice(0, 4) }) : tr("report.accountGravatar")}
                      </p>
                    </div>
                    {a.hasPassword && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-accent">{tr("report.accountPassword")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}

        {/* Respuesta literal de cada asistente de IA */}
        {report.assistants && report.assistants.some((a) => a.status === "ok") && (
          <details className={"group min-w-0 overflow-hidden " + CARD}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                {tr("report.assistantsTitle")}
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{report.assistants.filter((a) => a.status === "ok").length}</span>
              </span>
              <Chevron cls="group-open:rotate-180" />
            </summary>
            <div className="border-t border-line px-5 pt-3 pb-4">
              <p className="text-[13px] leading-relaxed text-muted">{tr("report.assistantsBody", { name: fullName })}</p>
              <ul className="mt-3 grid gap-3">
                {report.assistants.map((a) => (
                  <li key={a.provider} className="rounded-[14px] bg-surface-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold text-ink">{tr(`report.assistantNames.${a.provider}`)}</p>
                      {a.status === "ok" && (
                        <span className="flex flex-wrap items-center gap-3">
                          {pro ? (
                            <form action="/api/ai-requests" method="post">
                              <input type="hidden" name="request_id" value={requestId} />
                              <input type="hidden" name="provider" value={a.provider} />
                              <button type="submit" className="text-[12.5px] font-medium text-accent underline underline-offset-4">{tr("aiReq.withRastro")}</button>
                            </form>
                          ) : (
                            <Link href="/pro" className="text-[12.5px] font-medium text-muted underline underline-offset-4">{tr("aiReq.withRastro")} · {tr("pro.badge")}</Link>
                          )}
                          <a href={AI_RECTIFY[a.provider].url} target="_blank" rel="noreferrer nofollow" className="text-[12.5px] font-medium text-muted underline underline-offset-4 hover:text-ink">
                            {tr("report.rectify", { name: AI_RECTIFY[a.provider].name })}
                          </a>
                        </span>
                      )}
                    </div>
                    {a.status === "ok" ? (
                      <>
                        <blockquote className="mt-2 whitespace-pre-line border-l-2 border-accent pl-3 text-[13.5px] leading-relaxed text-muted">{a.answer}</blockquote>
                        {a.sources.length > 0 && (
                          <p className="mt-2 text-[12px] text-faint">
                            {tr("report.assistantSources")}:{" "}
                            {a.sources.slice(0, 5).map((s, i) => (
                              <span key={s.url}>
                                {i > 0 && " · "}
                                <a href={s.url} target="_blank" rel="noreferrer nofollow" className="underline underline-offset-4 hover:text-ink">{hostOf(s.url) ?? s.url}</a>
                              </span>
                            ))}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-1 text-[13px] text-faint">{tr(a.status === "failed" ? "report.assistantFailed" : "report.assistantSkipped")}</p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-faint">{tr("report.rectifyHint")}</p>
            </div>
          </details>
        )}

        {grouped.map(({ category, items }) => {
          const worst: Severity = items.some(({ f }) => f.severity === "high")
            ? "high"
            : items.some(({ f }) => f.severity === "medium")
              ? "medium"
              : items.every(({ f }) => f.severity === "info")
                ? "info"
                : "low";
          return (
            <details key={category} className={"group min-w-0 overflow-hidden " + CARD} open={worst === "high"}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
                  <span aria-hidden="true" className={"h-2 w-2 rounded-full " + SEVERITY_DOT[worst]} />
                  {tr(`report.categories.${category}`)}
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{items.length}</span>
                </span>
                <Chevron cls="group-open:rotate-180" />
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {items.map(({ f, index }) => {
                  const host = hostOf(f.source_url);
                  const known = host ? brokerForHost(host) : null;
                  return (
                    <li key={index} className="min-w-0">
                      <details className="group/item min-w-0 overflow-hidden">
                        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
                          <span aria-hidden="true" className={"h-2 w-2 shrink-0 rounded-full " + SEVERITY_DOT[f.severity]} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-medium text-ink">{f.title}</span>
                            {host && <span className="block truncate text-[12px] text-faint">{host}</span>}
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-faint">{tr(`report.severity.${f.severity}`)}</span>
                          <Chevron cls="group-open/item:rotate-180" />
                        </summary>
                        <div className="grid gap-2.5 bg-surface-2/60 px-5 pt-1 pb-4 pl-10">
                          <p className="text-[14px] leading-[1.6] text-muted">{f.detail}</p>
                          {known && (
                            <Link href={`/sitios/${known.slug}`} className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-[12.5px] font-medium text-accent" title={tr("sites.knownHint")}>
                              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                              {tr("sites.known")} · {known.typicalDays === 0 ? tr("sites.typicalInstant") : known.typicalDays ? tr("sites.typical", { n: known.typicalDays }) : known.name}
                            </Link>
                          )}
                          {f.source_url && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                              <a href={f.source_url} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent underline underline-offset-4">
                                {tr("report.source")}
                                <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                                  <path d="M6 3h7v7M13 3 6.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </a>
                              {(category === "profiles" || category === "ai") && f.severity !== "info" && (
                                pro ? (
                                  <form action="/api/letters" method="post">
                                    <input type="hidden" name="request_id" value={requestId} />
                                    <input type="hidden" name="finding_index" value={index} />
                                    <button type="submit" className="text-[13px] font-medium text-muted underline underline-offset-4 hover:text-ink">
                                      {tr("letters.generate")}
                                    </button>
                                  </form>
                                ) : (
                                  <Link href="/pro" className="text-[13px] font-medium text-muted underline underline-offset-4 hover:text-ink">
                                    {tr("letters.generate")} · {tr("pro.badge")}
                                  </Link>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}

        <footer className="grid gap-3 px-1 pt-2">
          <p className="text-[12.5px] leading-relaxed text-faint">{tr("report.generated", { date })}</p>
          <Link href="/#form" className="w-fit text-[14px] font-medium text-accent underline underline-offset-4">
            {tr("report.again")}
          </Link>
        </footer>
      </div>
    </article>
    </ReportExperience>
  );
}
