import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { levelFor } from "@/lib/report/score";

export const dynamic = "force-dynamic";

interface LetterRow {
  id: string;
  host: string;
  status: "draft" | "sent" | "answered" | "no_answer" | "closed";
  deadline_at: string | null;
  created_at: string;
}

interface Row {
  id: string;
  full_name: string;
  city: string | null;
  status: string;
  created_at: string;
  reports: { score: number } | { score: number }[] | null;
}

const LEVEL_TEXT = { green: "text-ok", orange: "text-accent", red: "text-danger" } as const;

function scoreOf(row: Row): number | null {
  const r = Array.isArray(row.reports) ? row.reports[0] : row.reports;
  return r ? r.score : null;
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/entrar");

  const user = await findUserByEmail(session.email);
  if (!user) redirect("/entrar");

  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const { data: rows } = await supabaseAdmin()
    .from("requests")
    .select("id, full_name, city, status, created_at, reports(score)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Row[]>();

  const list = rows ?? [];

  const { data: letterRows } = await supabaseAdmin()
    .from("letters")
    .select("id, host, status, deadline_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<LetterRow[]>();
  const letters = letterRows ?? [];

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] px-5 py-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-ink">{tr("account.title")}</h1>
            <p className="mt-1 text-[13px] text-faint">{tr("account.signedInAs", { email: user.email })}</p>
          </div>
          <span className="rounded-full bg-paper px-3 py-1 text-[12px] font-semibold text-muted">
            {tr(`account.plan.${user.plan}`)}
          </span>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">{tr("account.subtitle")}</p>

        {/* Vigilancia mensual */}
        <section className="mt-8 rounded-card border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">{tr("monitor.title")}</h2>
            <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide " + (user.monitoring ? "bg-accent text-white" : "bg-paper text-faint")}>
              {user.monitoring ? tr("monitor.on") : tr("monitor.off")}
            </span>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">{tr("monitor.body")}</p>
          {user.monitoring && (
            <p className="mt-2 text-[12.5px] text-faint">
              {user.monitor_last_at
                ? tr("monitor.nextCheck", { date: fmt.format(new Date(new Date(user.monitor_last_at).getTime() + 30 * 86_400_000)) })
                : tr("monitor.neverChecked")}
            </p>
          )}
          <form action="/api/monitor" method="post" className="mt-4 grid gap-2">
            <input type="hidden" name="enabled" value={user.monitoring ? "0" : "1"} />
            <button
              type="submit"
              className={
                user.monitoring
                  ? "w-fit text-[14px] font-medium text-muted underline underline-offset-4 hover:text-ink"
                  : "w-fit rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-white hover:opacity-90"
              }
            >
              {user.monitoring ? tr("monitor.disable") : tr("monitor.enable")}
            </button>
            {!user.monitoring && <p className="text-[12px] leading-relaxed text-faint">{tr("monitor.consent")}</p>}
          </form>
        </section>

        <h2 className="mt-10 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("account.reports")}</h2>

        {list.length === 0 ? (
          <p className="mt-4 text-[15px] text-muted">{tr("account.empty")}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {list.map((row) => {
              const score = scoreOf(row);
              return (
                <li key={row.id} className="rounded-card border border-line bg-surface p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-ink">
                        {row.full_name}
                        {row.city && <span className="font-normal text-muted"> · {row.city}</span>}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-faint">
                        {fmt.format(new Date(row.created_at))} · {tr(`account.status.${row.status}`)}
                      </p>
                    </div>
                    {score !== null ? (
                      <span className={"text-[28px] font-semibold tracking-[-0.03em] " + LEVEL_TEXT[levelFor(score)]}>{score}</span>
                    ) : (
                      <span className="text-[13px] text-faint">—</span>
                    )}
                  </div>
                  {(row.status === "done" || row.status === "processing" || row.status === "verified") && (
                    <Link href={`/informe/${row.id}`} className="mt-3 inline-block text-[13px] font-medium text-accent underline underline-offset-4">
                      {tr("account.view")}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Proximos plazos (cartas enviadas, ordenadas por vencimiento) */}
        {(() => {
          const pending = letters
            .filter((l) => l.status === "sent" && l.deadline_at)
            .sort((a, b) => new Date(a.deadline_at!).getTime() - new Date(b.deadline_at!).getTime());
          const today = new Date();
          return (
            <section className="mt-8 rounded-card border border-line bg-surface p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold text-ink">{tr("deadlines.title")}</h2>
              {pending.length === 0 ? (
                <p className="mt-2 text-[14px] text-muted">{tr("deadlines.none")}</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {pending.map((l) => {
                    const d = new Date(l.deadline_at!);
                    const days = Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
                    const late = days < 0;
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-3 text-[14px]">
                        <Link href={`/cartas/${l.id}`} className="truncate font-medium text-ink underline-offset-4 hover:underline">
                          {l.host}
                        </Link>
                        <span className={"shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold " + (late ? "bg-accent text-white" : days <= 3 ? "bg-accent-soft text-accent" : "bg-paper text-muted")}>
                          {late ? tr("deadlines.overdueShort") : days === 0 ? tr("deadlines.today") : tr("deadlines.daysLeft", { n: days })}
                          {" · "}
                          {fmt.format(d)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })()}

        {/* Cartas RGPD */}
        <h2 className="mt-10 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("letters.listTitle")}</h2>
        {letters.length === 0 ? (
          <p className="mt-4 text-[14px] leading-relaxed text-muted">{tr("letters.listEmpty")}</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {letters.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">{l.host}</p>
                  <p className="text-[12.5px] text-faint">
                    {tr(`letters.status.${l.status}`)}
                    {l.status === "sent" && l.deadline_at && ` · ${tr("letters.deadline", { date: fmt.format(new Date(l.deadline_at)) })}`}
                  </p>
                </div>
                <Link href={`/cartas/${l.id}`} className="shrink-0 text-[13px] font-medium text-accent underline underline-offset-4">
                  {tr("letters.open")}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/#form" className="rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-white hover:opacity-90">
            {tr("account.newReport")}
          </Link>
          <form action="/api/session/logout" method="post">
            <button type="submit" className="text-[14px] font-medium text-muted underline underline-offset-4 hover:text-ink">
              {tr("nav.logout")}
            </button>
          </form>
        </div>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
