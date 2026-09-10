import Link from "next/link";
import { ShareButton } from "@/components/ShareButton";
import { translator, type Locale, type Messages } from "@/lib/i18n";
import { levelFor, type Level } from "@/lib/report/score";
import type { Action, Category, Finding, Severity } from "@/lib/report/findings";
import type { KnownAccount } from "@/lib/report/accounts";

/**
 * Visor del informe (Dia 4: diseno final). Estetica de informe medico:
 * papel claro, un solo acento, jerarquia clara. Pensado para captura de
 * pantalla en movil: la tarjeta del score es autosuficiente.
 */

export interface ReportData {
  score: number;
  summary: string;
  findings: Finding[];
  actions: Action[];
  created_at: string;
  generator: "ai" | "template";
  accounts?: KnownAccount[];
}

const CATEGORY_ORDER: Category[] = ["breaches", "ai", "profiles", "false"];

const LEVEL_TEXT: Record<Level, string> = { green: "text-ok", orange: "text-warn", red: "text-danger" };
const LEVEL_STROKE: Record<Level, string> = { green: "#c8ff3d", orange: "#ffb020", red: "#ff5f5f" };

const SEVERITY_CLASS: Record<Severity, string> = {
  high: "bg-accent text-black",
  medium: "bg-accent-soft text-accent",
  low: "bg-paper text-muted",
  info: "bg-paper text-faint",
};

const CARD = "rounded-card border border-line bg-surface shadow-[0_1px_2px_rgba(26,26,25,0.04)]";

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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={LEVEL_STROKE[level]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
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
}) {
  const tr = translator(messages);
  const level = levelFor(report.score);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(report.created_at));
  const total = report.findings.length;

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: report.findings.filter((f) => f.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <article className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="grid gap-4 lg:sticky lg:top-20">
      {/* Tarjeta principal: lo que la gente capturara y compartira */}
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
            <p className={"text-[20px] leading-tight font-semibold tracking-[-0.02em] " + LEVEL_TEXT[level]}>
              {tr(`report.level.${level}`)}
            </p>
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
      </div>

      <div className="grid gap-4">
      {/* Cuentas conocidas con este correo */}
      {report.accounts && report.accounts.length > 0 && (
        <section className={CARD + " p-5 sm:p-7"}>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            {tr("report.accountsTitle")}
            <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-faint">{report.accounts.length}</span>
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{tr("report.accountsHint")}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {report.accounts.map((a) => (
              <li key={(a.domain ?? a.name) + a.source} className="flex items-center justify-between gap-3 rounded-[10px] bg-paper px-3.5 py-2.5">
                <div className="min-w-0">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer nofollow" className="block truncate text-[14px] font-semibold text-ink underline-offset-4 hover:underline">
                      {a.name}
                    </a>
                  ) : (
                    <p className="truncate text-[14px] font-semibold text-ink">{a.name}</p>
                  )}
                  <p className="text-[12px] text-faint">
                    {a.source === "breach"
                      ? tr("report.accountBreach", { year: (a.date ?? "").slice(0, 4) })
                      : tr("report.accountGravatar")}
                  </p>
                </div>
                {a.hasPassword && (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-accent">
                    {tr("report.accountPassword")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Hallazgos */}
      <div className="flex items-baseline justify-between px-1 pt-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">
          {total === 1 ? tr("report.countOne") : tr("report.counts", { n: total })}
        </h2>
        <p className="text-[12.5px] text-faint">{tr("report.whatYouSee")}</p>
      </div>

      {grouped.map(({ category, items }) => (
        <section key={category} className={CARD + " p-5 sm:p-7"}>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            {tr(`report.categories.${category}`)}
            <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-faint">{items.length}</span>
          </h3>
          <ul className="mt-4 divide-y divide-line">
            {items.map((f, i) => (
              <li key={i} className="grid gap-1.5 py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2.5">
                  <span className={"mt-[3px] shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide " + SEVERITY_CLASS[f.severity]}>
                    {tr(`report.severity.${f.severity}`)}
                  </span>
                  <h4 className="text-[15px] leading-snug font-semibold text-ink">{f.title}</h4>
                </div>
                <p className="text-[14px] leading-[1.6] text-muted">{f.detail}</p>
                {f.source_url && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <a
                      href={f.source_url}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-accent underline underline-offset-4"
                    >
                      {tr("report.source")}
                      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                        <path d="M6 3h7v7M13 3 6.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                    {/* Carta de supresion (RGPD art. 17) para sitios que muestran datos de la persona */}
                    {(category === "profiles" || category === "ai") && f.severity !== "info" && (
                      pro ? (
                        <form action="/api/letters" method="post">
                          <input type="hidden" name="request_id" value={requestId} />
                          <input type="hidden" name="finding_index" value={report.findings.indexOf(f)} />
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
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Acciones */}
      {report.actions.length > 0 && (
        <section className={CARD + " border-accent/30 p-5 sm:p-7"}>
          <h3 className="text-[15px] font-semibold text-ink">{tr("report.actionsTitle")}</h3>
          <ol className="mt-4 grid gap-4">
            {report.actions.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-black"
                >
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
      <footer className="grid gap-3 px-1 pt-2 lg:col-span-2">
        <p className="text-[12.5px] leading-relaxed text-faint">{tr("report.generated", { date })}</p>
        <Link href="/#form" className="w-fit text-[14px] font-medium text-accent underline underline-offset-4">
          {tr("report.again")}
        </Link>
      </footer>
    </article>
  );
}
