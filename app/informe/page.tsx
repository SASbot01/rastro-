import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { levelFor } from "@/lib/report/score";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  full_name: string;
  city: string | null;
  status: string;
  created_at: string;
  reports: { score: number; summary: string } | { score: number; summary: string }[] | null;
}

interface ScanRow {
  id: string;
  mailbox: string;
  status: "processing" | "done" | "error";
  services: unknown[];
  started_at: string;
}

const LEVEL_TEXT = { green: "text-ok", orange: "text-warn", red: "text-danger" } as const;

function reportOf(row: Row) {
  return Array.isArray(row.reports) ? (row.reports[0] ?? null) : row.reports;
}

/**
 * Pestana "Informe": tus informes (el ultimo destacado) y pedir uno nuevo.
 * Sin sesion: que es un informe y como conseguirlo.
 */
export default async function ReportsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const supabase = user ? supabaseAdmin() : null;
  const [{ data }, { data: scan }] = user && supabase
    ? await Promise.all([
        supabase
          .from("requests")
          .select("id, full_name, city, status, created_at, reports(score, summary)")
          .eq("user_id", user.id)
          .in("status", ["done", "processing", "verified", "error"])
          .order("created_at", { ascending: false })
          .limit(30)
          .returns<Row[]>(),
        // Ultimo sondeo del buzon (Gmail): se ve desde aqui y abre la herramienta.
        supabase
          .from("mailbox_scans")
          .select("id, mailbox, status, services, started_at")
          .eq("user_id", user.id)
          .in("status", ["done", "processing"])
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle<ScanRow>(),
      ])
    : [{ data: null }, { data: null }];
  const list = data ?? [];
  const [latest, ...rest] = list;
  const latestReport = latest ? reportOf(latest) : null;

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("report.eyebrow")}</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em] text-ink">{tr("reports.title")}</h1>
          </div>
          <Link href="/#form" className="rounded-[12px] bg-accent px-4 py-2.5 text-[14px] font-semibold text-black hover:opacity-90">
            {tr("account.newReport")}
          </Link>
        </div>

        {!user ? (
          <section className="mt-6 rounded-card border border-line bg-surface p-6">
            <p className="text-[15px] font-semibold text-ink">{tr("reports.loginTitle")}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("reports.loginBody")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/#form" className="rounded-[12px] bg-accent px-4 py-2.5 text-[14px] font-semibold text-black hover:opacity-90">{tr("reports.first")}</Link>
              <Link href="/entrar" className="rounded-[12px] border border-line bg-surface-2 px-4 py-2.5 text-[14px] font-semibold text-ink hover:border-faint">{tr("nav.login")}</Link>
            </div>
          </section>
        ) : list.length === 0 ? (
          <section className="mt-6 rounded-card border border-line bg-surface p-6">
            <p className="text-[15px] font-semibold text-ink">{tr("account.empty")}</p>
            <Link href="/#form" className="mt-4 inline-block rounded-[12px] bg-accent px-4 py-2.5 text-[14px] font-semibold text-black hover:opacity-90">{tr("reports.first")}</Link>
          </section>
        ) : (
          <>
            {/* Ultimo informe, destacado */}
            <Link href={`/informe/${latest.id}`} className="mt-6 block rounded-card border border-line bg-surface p-6 hover:border-faint sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("reports.latest")}</p>
                  <p className="mt-1 truncate text-[18px] font-semibold text-ink">
                    {latest.full_name}
                    {latest.city && <span className="font-normal text-muted"> · {latest.city}</span>}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-faint">{fmt.format(new Date(latest.created_at))} · {tr(`account.status.${latest.status}`)}</p>
                  {latestReport?.summary && <p className="mt-3 line-clamp-3 text-[14px] leading-relaxed text-muted">{latestReport.summary}</p>}
                </div>
                {latestReport ? (
                  <span className={"shrink-0 text-[44px] font-semibold tracking-[-0.04em] " + LEVEL_TEXT[levelFor(latestReport.score)]}>{latestReport.score}</span>
                ) : (
                  <span className="shrink-0 text-[13px] text-faint">—</span>
                )}
              </div>
              <span className="mt-4 inline-block text-[13px] font-medium text-accent underline underline-offset-4">{tr("account.view")}</span>
            </Link>

            {rest.length > 0 && (
              <section className="mt-8">
                <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("reports.previous")}</h2>
                <ul className="mt-3 grid gap-2">
                  {rest.map((row) => {
                    const r = reportOf(row);
                    return (
                      <li key={row.id}>
                        <Link href={`/informe/${row.id}`} className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3.5 hover:border-faint sm:px-5">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold text-ink">
                              {row.full_name}
                              {row.city && <span className="font-normal text-muted"> · {row.city}</span>}
                            </p>
                            <p className="mt-0.5 text-[12.5px] text-faint">{fmt.format(new Date(row.created_at))} · {tr(`account.status.${row.status}`)}</p>
                          </div>
                          {r ? <span className={"text-[24px] font-semibold tracking-[-0.03em] " + LEVEL_TEXT[levelFor(r.score)]}>{r.score}</span> : <span className="text-[13px] text-faint">—</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Sondeo de Gmail */}
        {user && (
          <section className="mt-8">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("reports.scanTitle")}</h2>
            {scan ? (
              <Link href={`/cuenta/buzon?scan=${scan.id}`} className="mt-3 flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3.5 hover:border-faint sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">
                    {scan.status === "processing" ? tr("reports.scanProcessing") : tr("reports.scanServices", { n: scan.services.length })}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-faint">{scan.mailbox} · {fmt.format(new Date(scan.started_at))}</p>
                </div>
                <span className="shrink-0 text-[13px] font-medium text-accent underline underline-offset-4">{tr("reports.scanOpen")}</span>
              </Link>
            ) : (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink">{tr("reports.scanNone")}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{tr("reports.scanBody")}</p>
                </div>
                <Link href="/cuenta/buzon" className="shrink-0 rounded-[12px] border border-line bg-surface-2 px-4 py-2.5 text-[14px] font-semibold text-ink hover:border-faint">{tr("reports.scanCta")}</Link>
              </div>
            )}
          </section>
        )}
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
