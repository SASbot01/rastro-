import { translator, type Locale, type Messages } from "@/lib/i18n";
import { levelFor } from "@/lib/report/score";
import type { Action, Category, Finding, Severity } from "@/lib/report/findings";

/**
 * Visor del informe. Version funcional del Dia 2; el diseno final y el boton
 * de compartir llegan en los Dias 4 y 5.
 */

export interface ReportData {
  score: number;
  summary: string;
  findings: Finding[];
  actions: Action[];
  created_at: string;
}

const CATEGORY_ORDER: Category[] = ["breaches", "ai", "profiles", "false"];

const LEVEL_CLASS = {
  green: "text-ok",
  orange: "text-accent",
  red: "text-danger",
} as const;

const SEVERITY_CLASS: Record<Severity, string> = {
  high: "bg-accent-soft text-accent",
  medium: "bg-accent-soft/60 text-accent",
  low: "bg-paper text-muted",
  info: "bg-paper text-faint",
};

export function ReportView({
  report,
  fullName,
  locale,
  messages,
  partial,
}: {
  report: ReportData;
  fullName: string;
  locale: Locale;
  messages: Messages;
  /** Muestra el aviso de version preliminar (sin la parte de IA). */
  partial?: boolean;
}) {
  const tr = translator(messages);
  const level = levelFor(report.score);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(report.created_at));

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: report.findings.filter((f) => f.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <article className="grid gap-5">
      {/* Cabecera con el score */}
      <section className="rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(26,26,25,0.04)] sm:p-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("report.eyebrow")}</p>
        <p className="mt-1 text-[14px] text-muted">{tr("report.for", { name: fullName })}</p>

        <div className="mt-6 flex items-end gap-4">
          <span className={"text-[72px] leading-none font-semibold tracking-[-0.04em] " + LEVEL_CLASS[level]}>
            {report.score}
          </span>
          <div className="pb-2">
            <p className="text-[13px] text-faint">{tr("report.outOf")}</p>
            <p className={"text-[15px] font-semibold " + LEVEL_CLASS[level]}>{tr(`report.level.${level}`)}</p>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-paper" aria-hidden="true">
          <div
            className={"h-full rounded-full " + (level === "green" ? "bg-ok" : level === "orange" ? "bg-accent" : "bg-danger")}
            style={{ width: `${report.score}%` }}
          />
        </div>

        <p className="mt-5 text-[15px] leading-relaxed text-ink">{report.summary}</p>
        {partial && <p className="mt-3 text-[12.5px] leading-relaxed text-faint">{tr("report.partial")}</p>}
      </section>

      {/* Hallazgos por categoria */}
      {grouped.map(({ category, items }) => (
        <section key={category} className="rounded-card border border-line bg-surface p-6 sm:p-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">
            {tr(`report.categories.${category}`)}
          </h2>
          <ul className="mt-4 grid gap-5">
            {items.map((f, i) => (
              <li key={i} className="grid gap-1.5">
                <div className="flex items-start gap-2.5">
                  <span className={"mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold " + SEVERITY_CLASS[f.severity]}>
                    {tr(`report.severity.${f.severity}`)}
                  </span>
                  <h3 className="text-[15px] leading-snug font-semibold text-ink">{f.title}</h3>
                </div>
                <p className="text-[14px] leading-relaxed text-muted">{f.detail}</p>
                {f.source_url && (
                  <a
                    href={f.source_url}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="text-[13px] font-medium text-accent underline underline-offset-4"
                  >
                    {tr("report.source")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Acciones */}
      {report.actions.length > 0 && (
        <section className="rounded-card border border-line bg-surface p-6 sm:p-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("report.actionsTitle")}</h2>
          <ol className="mt-4 grid gap-4">
            {report.actions.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-white"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">{a.title}</h3>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-muted">{a.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="px-1 text-[12.5px] text-faint">{tr("report.generated", { date })}</p>
    </article>
  );
}
