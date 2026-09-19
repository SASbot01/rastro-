import Link from "next/link";
import { AskBubble } from "@/components/AskBubble";
import { GuideChecklist } from "@/components/GuideChecklist";
import { RemovalCounter } from "@/components/RemovalCounter";
import { removalStats, type RemovalStats } from "@/lib/removals";
import { knowledgeLevel, type AiChange, type FactsByProvider, type WatchProvider } from "@/lib/ai-watch-core";
import { ScoreRing } from "@/components/experience/ScoreRing";
import { EmptyState } from "@/components/experience/EmptyState";
import { translator, type Locale, type Messages } from "@/lib/i18n";
import { levelFor, type Level } from "@/lib/report/score";
import { supabaseAdmin } from "@/lib/supabase";
import type { UserRow } from "@/lib/users";

interface Finding { category: string; title: string; detail: string; severity: "high" | "medium" | "low" | "info" }
interface Action { title: string; detail: string }
interface ReportRow {
  request_id: string;
  score: number;
  breakdown: Record<string, number> | null;
  findings: Finding[] | null;
  actions: Action[] | null;
  created_at: string;
  requests: { full_name: string; status: string; user_id: string } | { full_name: string; status: string; user_id: string }[] | null;
}
interface AiSnapLite { facts: FactsByProvider; changes: AiChange[]; taken_at: string }
interface ScanRow { id: string; status: string; services: unknown[]; started_at: string }

const CARD = "flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface";
const LEVEL_TEXT: Record<Level, string> = { green: "text-ok", orange: "text-warn", red: "text-danger" };
const LEVEL_HEX: Record<Level, string> = { green: "#4dfc5f", orange: "#ffb020", red: "#ff5f5f" };
const RULE_COLOR: Record<string, string> = {
  breachWithPassword: "#ff5f5f",
  breachWithoutPassword: "#ffb020",
  publicProfile: "#a3a39e",
  aiKnowsEmployer: "#8c988b",
  aiKnowsCity: "#b8c4b4",
  contactDataPublic: "#ffb020",
  aiFalseData: "#d0b87a",
};
const SEVERITY_RANK = { high: 0, medium: 1, low: 2, info: 3 } as const;
const SEVERITY_CLS = { high: "bg-danger/15 text-danger", medium: "bg-warn/15 text-warn", low: "bg-accent-soft text-accent", info: "bg-surface-2 text-muted" } as const;
const CATEGORY_INITIAL: Record<string, string> = { breaches: "F", ai: "IA", profiles: "P", false: "?" };

/** Donut de puntos perdidos por motivo; el resto (score) en verde. */
function Donut({ segments, score, size = 168 }: { segments: Array<{ key: string; points: number; color: string }>; score: number; size?: number }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const parts = [...segments.map((s) => ({ ...s, value: Math.abs(s.points) })), { key: "remaining", points: score, color: "#4dfc5f", value: score }];
  // Penalties can total more than 100 when the score is clamped at zero.
  const total = Math.max(100, parts.reduce((sum, part) => sum + part.value, 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1d1d1d" strokeWidth={stroke} />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = len > 0 && (
            <circle key={p.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeLinecap="butt" strokeDasharray={`${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={"text-[40px] font-semibold leading-none tracking-[-0.04em] " + LEVEL_TEXT[levelFor(score)]}>{score}</span>
        <span className="mt-1 text-[11px] text-faint">/ 100</span>
      </div>
    </div>
  );
}

/** Barras: una por informe, altura = puntuacion, resto en gris. */
function Bars({ points, locale }: { points: Array<{ score: number; date: Date }>; locale: Locale }) {
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const w = 320;
  const h = 140;
  const pad = 26;
  const n = points.length;
  const slot = (w - pad) / n;
  const bw = Math.min(34, slot * 0.55);
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} className="h-auto w-full" role="img" aria-label={points.map((p) => `${fmt.format(p.date)}: ${p.score}/100`).join("; ")}>
      {[0, 50, 100].map((v) => {
        const y = h - (v / 100) * h;
        return (
          <g key={v}>
            <line x1={pad} x2={w} y1={y} y2={y} stroke="#262626" strokeDasharray="3 4" />
            <text x={0} y={y + 4} fontSize="10" fill="#6f6f6a">{v}</text>
          </g>
        );
      })}
      {points.map((p, i) => {
        const x = pad + slot * i + (slot - bw) / 2;
        const sh = Math.max(3, (p.score / 100) * h);
        return (
          <g key={i}>
            <rect x={x} y={0} width={bw} height={h} rx={6} fill="#1d1d1d" />
            <rect x={x} y={h - sh} width={bw} height={sh} rx={6} fill={LEVEL_HEX[levelFor(p.score)]} />
            <text x={x + bw / 2} y={h - sh - 5} fontSize="11" fontWeight="600" textAnchor="middle" fill="#f4f4f2">{p.score}</text>
            <text x={x + bw / 2} y={h + 16} fontSize="10" textAnchor="middle" fill="#6f6f6a">{fmt.format(p.date)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function reqOf(r: ReportRow) {
  return Array.isArray(r.requests) ? r.requests[0] : r.requests;
}

/**
 * Inicio con sesion: panel con la puntuacion actual, donde se pierden puntos,
 * evolucion, hallazgos principales, guia de pasos y accesos rapidos.
 * La portada comercial solo se ve sin sesion.
 */
export async function Dashboard({ locale, messages, user }: { locale: Locale; messages: Messages; user: UserRow }) {
  const tr = translator(messages);
  const supabase = supabaseAdmin();
  const [{ data: reports }, { data: scan }, { count: letters }, removals, { data: aiSnap }] = await Promise.all([
    supabase
      .from("reports")
      .select("request_id, score, breakdown, findings, actions, created_at, requests!inner(full_name, status, user_id)")
      .eq("requests.user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<ReportRow[]>(),
    supabase.from("mailbox_scans").select("id, status, services, started_at").eq("user_id", user.id).eq("status", "done").order("started_at", { ascending: false }).limit(1).maybeSingle<ScanRow>(),
    supabase.from("letters").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    removalStats(user.id),
    supabase.from("ai_snapshots").select("facts, changes, taken_at").eq("user_id", user.id).order("taken_at", { ascending: false }).limit(1).maybeSingle<AiSnapLite>(),
  ]);
  const list = reports ?? [];
  const latest = list[0] ?? null;
  const previous = list[1] ?? null;
  const name = user.display_name?.split(" ")[0] ?? (latest ? reqOf(latest)?.full_name : null)?.split(" ")[0] ?? user.email.split("@")[0];
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const chips = messages.dash.askChips as string[];

  const quick = [
    { href: "/#form", label: tr("dash.quick.report"), icon: "M12 5v14M5 12h14" },
    { href: "/cuenta/buzon", label: tr("dash.quick.scan"), icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
    { href: "/guardian", label: tr("guardian.title"), icon: "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" },
  ];

  return (
    <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-8 sm:py-10">
      <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-ink">{tr("dash.hello", { name })}</h1>
      <p className="mt-2 text-sm text-muted">{tr("experience.dashboardBody")}</p>

      {!latest ? (
        <section className={CARD + " mt-5 p-6"}>
          <EmptyState title={tr("dash.noReportTitle")} body={tr("dash.noReportBody")} href="/#form" cta={tr("dash.noReportCta")}/>
        </section>
      ) : (
        <DashboardBody locale={locale} messages={messages} user={user} latest={latest} previous={previous} list={list} scan={scan ?? null} letters={letters ?? 0} removals={removals} aiSnap={aiSnap ?? null} quick={quick} dateFmt={dateFmt} />
      )}

      {/* Preguntale a Rastro */}
      <section className="mt-6">
        <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("dash.askTitle")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((q) => (
            <AskBubble key={q} label={q} question={q} className="!shadow-none !border-line hover:!border-accent" />
          ))}
        </div>
      </section>
    </main>
  );
}

function DashboardBody({ locale, messages, user, latest, previous, list, scan, letters, removals, aiSnap, quick, dateFmt }: {
  locale: Locale; messages: Messages; user: UserRow; latest: ReportRow; previous: ReportRow | null; list: ReportRow[]; scan: ScanRow | null; letters: number; removals: RemovalStats; aiSnap: AiSnapLite | null;
  quick: Array<{ href: string; label: string; icon: string }>; dateFmt: Intl.DateTimeFormat;
}) {
  const tr = translator(messages);
  const level = levelFor(latest.score);
  const delta = previous ? latest.score - previous.score : null;
  const segments = Object.entries(latest.breakdown ?? {})
    .filter(([, v]) => v < 0)
    .sort((a, b) => a[1] - b[1])
    .map(([key, points]) => ({ key, points, color: RULE_COLOR[key] ?? "#a3a39e" }));
  const findings = [...(latest.findings ?? [])].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]).slice(0, 4);
  const actions = latest.actions ?? [];
  const history = [...list].reverse().map((r) => ({ score: r.score, date: new Date(r.created_at) }));
  const nextCheck = user.monitoring && user.monitor_last_at ? new Date(new Date(user.monitor_last_at).getTime() + 30 * 86_400_000) : null;

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {/* Puntuacion */}
      <section className="relative min-w-0 overflow-hidden rounded-card border border-line bg-surface p-6 lg:col-span-2">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl" style={{ background: LEVEL_HEX[level], opacity: 0.16 }} aria-hidden="true" />
        <div className="flex flex-wrap items-center justify-between gap-6"><div><p className="ex-eyebrow">{tr("experience.label")}</p><h2 className="mt-3 max-w-[16ch] text-3xl font-medium tracking-[-.04em]">{tr("experience.dashboardTitle")}</h2><p className="ex-note mt-3">{tr("experience.highScore")}</p><Link className="ex-button mt-5" href={`/informe/${latest.request_id}`}>{tr("experience.viewReport")} ↗</Link></div><ScoreRing score={latest.score} label={tr("experience.score")} size={180}/></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={"rounded-full px-3 py-1 text-[12.5px] font-semibold " + SEVERITY_CLS[level === "green" ? "low" : level === "orange" ? "medium" : "high"]}>{tr(`report.level.${level}`)}</span>
          <span className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[12.5px] text-muted">
            {delta === null ? tr("dash.first") : delta === 0 ? tr("dash.deltaFlat") : tr("dash.delta", { n: (delta > 0 ? "+" : "") + delta })}
          </span>
          <span className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[12.5px] text-faint">{tr("dash.updated", { date: dateFmt.format(new Date(latest.created_at)) })}</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {quick.map((q) => (
            <Link key={q.href} href={q.href} className="flex flex-col items-center gap-1.5 rounded-[14px] border border-line bg-surface-2 px-2 py-3 text-center text-[12.5px] font-semibold text-ink hover:border-accent">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" aria-hidden="true"><path d={q.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {q.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Retiradas comprobadas */}
      {removals.found > 0 && <div className="min-w-0 lg:col-span-2"><RemovalCounter stats={removals} messages={messages} href={removals.found > removals.requested ? `/informe/${latest.request_id}` : "/herramientas"} /></div>}

      {/* La IA y tu */}
      {aiSnap && (
        <section className={CARD + " p-6 lg:col-span-2"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-ink">{tr("aiWatch.dashTitle")}</h2>
              <p className={"mt-1 text-[13px] " + (aiSnap.changes.some((c) => !c.minor) ? "text-warn" : "text-muted")}>
                {aiSnap.changes.some((c) => !c.minor) ? tr("aiWatch.dashChanged", { n: aiSnap.changes.filter((c) => !c.minor).length }) : tr("aiWatch.dashSame")} · {dateFmt.format(new Date(aiSnap.taken_at))}
              </p>
            </div>
            <Link href="/ia" className="text-[13px] font-medium text-accent underline underline-offset-4">{tr("aiWatch.dashOpen")}</Link>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {(Object.keys(aiSnap.facts) as WatchProvider[]).map((p) => {
              const lv = knowledgeLevel(aiSnap.facts[p]);
              return (
                <li key={p} className="min-w-0 rounded-[14px] bg-surface-2 px-3.5 py-3">
                  <p className="flex items-baseline justify-between text-[13px] font-semibold text-ink"><span>{tr(`aiWatch.providers.${p}`)}</span><span>{lv}<span className="text-faint">/100</span></span></p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div className={"h-full rounded-full " + (lv >= 60 ? "bg-danger" : lv >= 30 ? "bg-warn" : "bg-accent")} style={{ width: `${Math.max(3, lv)}%` }} /></div>
                  <p className="mt-1.5 truncate text-[11.5px] text-faint">{lv === 0 ? tr("aiWatch.knowsNothing") : tr("aiWatch.knows")}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Donut */}
      <section className={CARD + " p-6"}>
        <h2 className="text-[16px] font-semibold text-ink">{tr("dash.donutTitle")}</h2>
        <p className="mt-1 text-[13px] text-muted">{tr("dash.donutBody")}</p>
        <div className="mt-5 flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center">
          <Donut segments={segments} score={latest.score} />
          <ul className="grid w-full gap-2">
            {segments.length === 0 && <li className="text-[13.5px] text-muted">{tr("dash.clean")}</li>}
            {segments.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex items-center gap-2 text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{tr(`dash.rules.${s.key}`)}</span>
                <span className="font-semibold text-ink">{s.points}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 border-t border-line pt-2 text-[13px]">
              <span className="flex items-center gap-2 text-muted"><span className="h-2.5 w-2.5 rounded-full bg-accent" />{tr("dash.remaining")}</span>
              <span className="font-semibold text-accent">{latest.score}</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Evolucion */}
      <section className={CARD + " p-6"}>
        <h2 className="text-[16px] font-semibold text-ink">{tr("dash.historyTitle")}</h2>
        <p className="mt-1 text-[13px] text-muted">{tr("dash.historyBody")}</p>
        <div className="mt-4 flex-1"><Bars points={history} locale={locale} /></div>
        <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
          <Link href="/herramientas" className="flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 hover:border-accent">
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                {user.monitoring && <span className="h-2 w-2 rounded-full bg-accent" />}
                {tr(user.monitoring ? "dash.vigil.on" : "dash.vigil.off")}
              </span>
              <span className="block truncate text-[11.5px] text-faint">{nextCheck ? tr("dash.vigil.next", { date: dateFmt.format(nextCheck) }) : tr("dash.vigil.cta")}</span>
            </span>
          </Link>
          <Link href={scan ? `/cuenta/buzon?scan=${scan.id}` : "/cuenta/buzon"} className="flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 hover:border-accent">
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">{tr("dash.scan.title")}</span>
              <span className="block truncate text-[11.5px] text-faint">{scan ? tr("dash.scan.services", { n: scan.services.length }) + " · " + dateFmt.format(new Date(scan.started_at)) : tr("dash.scan.none") + " · " + tr("dash.scan.cta")}</span>
            </span>
          </Link>
        </div>
      </section>

      {/* Hallazgos principales */}
      <section className={CARD + " p-6"}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-ink">{tr("dash.topTitle")}</h2>
          <Link href={`/informe/${latest.request_id}`} className="text-[13px] font-medium text-accent underline underline-offset-4">{tr("dash.seeAll")}</Link>
        </div>
        <ul className="mt-4 grid min-w-0 gap-2">
          {findings.map((f, i) => (
            <li key={i} className="min-w-0">
              <Link href={`/informe/${latest.request_id}`} className="flex min-w-0 items-center gap-3 overflow-hidden rounded-[14px] bg-surface-2 px-3.5 py-3 hover:bg-line/60">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-[12px] font-semibold text-muted">{CATEGORY_INITIAL[f.category] ?? "•"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{f.title}</span>
                  <span className="block truncate text-[12px] text-faint">{tr(`report.categories.${f.category}`)}</span>
                </span>
                <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase " + SEVERITY_CLS[f.severity]}>{tr(`report.severity.${f.severity}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {letters > 0 && <p className="mt-3 text-[12.5px] text-faint">{tr("profile.letters")}: {letters}</p>}
      </section>

      {/* Guia */}
      <section className={CARD + " p-6"}>
        <h2 className="text-[16px] font-semibold text-ink">{tr("dash.guideTitle")}</h2>
        <p className="mt-1 text-[13px] text-muted">{actions.length ? tr("experience.missionHint") : tr("dash.guideEmpty")}</p>
        {actions.length > 0 && (
          <div className="mt-4">
            <GuideChecklist reportId={latest.request_id} items={actions} doneTemplate={tr("dash.guideDone")} />
          </div>
        )}
      </section>
    </div>
  );
}
