import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { isPro, prices } from "@/lib/plan";
import { RemovalCounter } from "@/components/RemovalCounter";
import { isRemoved, removalStats, type RemovalStats } from "@/lib/removals";

export const dynamic = "force-dynamic";

interface LetterRow {
  id: string;
  host: string;
  status: "draft" | "sent" | "answered" | "no_answer" | "closed";
  deadline_at: string | null;
  created_at: string;
  removed_at: string | null;
  outcome: string | null;
}
interface ScanRow {
  id: string;
  mailbox: string;
  status: string;
  services: unknown[];
  started_at: string;
}

const CARD = "rounded-card border border-line bg-surface p-5 sm:p-6";
const BTN = "inline-block rounded-[12px] bg-accent px-4 py-2.5 text-[14px] font-semibold text-black hover:opacity-90";
const LINK = "text-[13px] font-medium text-accent underline underline-offset-4";

/**
 * Herramientas: todo lo que Rastro hace por ti y en que estado esta.
 * Vigilancia, escaner de buzon, cartas y plazos. Perfil queda para la cuenta.
 */
export default async function ToolsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const pro = isPro(user);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  let letters: LetterRow[] = [];
  let lastScan: ScanRow | null = null;
  let removals: RemovalStats | null = null;
  if (user) {
    const supabase = supabaseAdmin();
    const [{ data: l }, { data: s }, r] = await Promise.all([
      supabase.from("letters").select("id, host, status, deadline_at, created_at, removed_at, outcome").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50).returns<LetterRow[]>(),
      supabase.from("mailbox_scans").select("id, mailbox, status, services, started_at").eq("user_id", user.id).eq("status", "done").order("started_at", { ascending: false }).limit(1).maybeSingle<ScanRow>(),
      removalStats(user.id),
    ]);
    removals = r;
    letters = l ?? [];
    lastScan = s ?? null;
  }
  const pending = letters
    .filter((l) => l.status === "sent" && l.deadline_at)
    .sort((a, b) => new Date(a.deadline_at!).getTime() - new Date(b.deadline_at!).getTime());
  // eslint-disable-next-line react-hooks/purity -- fecha de referencia para los plazos
  const today = Date.now();

  /** Aviso comun cuando no hay sesion o no hay Pro. */
  const gate = (
    <div className={CARD}>
      <p className="text-[15px] font-semibold text-ink">{!user ? tr("tools.loginTitle") : tr("pro.locked")}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-muted">{!user ? tr("tools.loginBody") : tr("pro.lockedBody", { monthly: prices().monthly, yearly: prices().yearly })}</p>
      <Link href={!user ? "/entrar" : "/pro"} className={"mt-4 " + BTN}>
        {!user ? tr("nav.login") : tr("pro.lockedCta")}
      </Link>
    </div>
  );

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-8 sm:py-12">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{pro ? tr("pro.badge") : tr("tools.eyebrow")}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em] text-ink">{tr("tools.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("tools.subtitle")}</p>

        {/* v2 y v3: para todos (gratis con limite; Pro completo) */}
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          <li><Link href="/ayuda-urgente" className={CARD + " block h-full border-danger/30 hover:border-danger"}><span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-danger">{tr("experience.emergency")}</span><h2 className="mt-1 text-[16px] font-semibold text-ink">{tr("experience.emergencyTitle")}</h2><p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{tr("experience.emergencyBody")}</p></Link></li>
          <li><Link href="/ia" className={CARD + " block h-full hover:border-accent"}><span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("aiWatch.eyebrow")}</span><h2 className="mt-1 text-[16px] font-semibold text-ink">{tr("aiWatch.hubTitle")}</h2><p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{tr("aiWatch.hubBody")}</p></Link></li>
          <li><Link href="/simulador" className={CARD + " block h-full hover:border-accent"}><span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("sim.eyebrow")}</span><h2 className="mt-1 text-[16px] font-semibold text-ink">{tr("sim.title")}</h2><p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{tr("sim.hubBody")}</p></Link></li>
          <li><Link href="/imagenes" className={CARD + " block h-full hover:border-accent"}><span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("images.eyebrow")}</span><h2 className="mt-1 text-[16px] font-semibold text-ink">{tr("images.title")}</h2><p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{tr("images.hubBody")}</p></Link></li>
          <li><Link href="/extension" className={CARD + " block h-full hover:border-accent"}><span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("ext.eyebrow")}</span><h2 className="mt-1 text-[16px] font-semibold text-ink">{tr("ext.title")}</h2><p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{tr("ext.hubBody")}</p></Link></li>
          <li><Link href="/guardian" className={CARD + " block h-full hover:border-accent"}><span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("guardian.eyebrow")}</span><h2 className="mt-1 text-[16px] font-semibold text-ink">{tr("guardian.title")}</h2><p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{tr("sim.guardianHubBody")}</p></Link></li>
        </ul>

        {!user || !pro ? (
          <div className="mt-6 grid gap-3">
            {gate}
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                [tr("monitor.title"), tr("monitor.body")],
                [tr("mailbox.title"), tr("account.mailboxCardBody")],
                [tr("letters.listTitle"), tr("tools.lettersBody")],
              ].map(([t, b]) => (
                <li key={t} className={CARD + " opacity-80"}>
                  <h2 className="text-[15px] font-semibold text-ink">{t}</h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-start">
            {removals && removals.found > 0 && <div className="min-w-0 lg:col-span-2"><RemovalCounter stats={removals} messages={messages} href="/informe" compact /></div>}
            {/* Vigilancia mensual */}
            <section className={CARD}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold text-ink">{tr("monitor.title")}</h2>
                <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide " + (user.monitoring ? "bg-accent text-black" : "bg-surface-2 text-faint")}>
                  {user.monitoring ? tr("monitor.on") : tr("monitor.off")}
                </span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{tr("monitor.body")}</p>
              {user.monitoring && user.monitor_last_at && (
                <p className="mt-2 text-[12.5px] text-faint">{tr("monitor.nextCheck", { date: fmt.format(new Date(new Date(user.monitor_last_at).getTime() + 30 * 86_400_000)) })}</p>
              )}
              <form action="/api/monitor" method="post" className="mt-4 grid gap-2">
                <input type="hidden" name="enabled" value={user.monitoring ? "0" : "1"} />
                <button type="submit" className={user.monitoring ? "w-fit text-[14px] font-medium text-muted underline underline-offset-4 hover:text-ink" : "w-fit " + BTN}>
                  {user.monitoring ? tr("monitor.disable") : tr("monitor.enable")}
                </button>
                {!user.monitoring && <p className="text-[12px] leading-relaxed text-faint">{tr("monitor.consent")}</p>}
              </form>
            </section>

            {/* Escaner de buzon */}
            <section className={CARD}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold text-ink">{tr("mailbox.title")}</h2>
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">{tr("mailbox.beta")}</span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{tr("account.mailboxCardBody")}</p>
              {lastScan ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] bg-surface-2 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">{tr("mailbox.doneTitle", { n: lastScan.services.length })}</p>
                    <p className="truncate text-[12px] text-faint">{lastScan.mailbox} · {fmt.format(new Date(lastScan.started_at))}</p>
                  </div>
                  <Link href={`/cuenta/buzon?scan=${lastScan.id}`} className={"shrink-0 " + LINK}>{tr("letters.open")}</Link>
                </div>
              ) : null}
              <Link href="/cuenta/buzon" className={"mt-4 " + BTN}>{lastScan ? tr("mailbox.rescan") : tr("mailbox.connect")}</Link>
            </section>

            {/* Proximos plazos */}
            <section className={CARD}>
              <h2 className="text-[16px] font-semibold text-ink">{tr("deadlines.title")}</h2>
              {pending.length === 0 ? (
                <p className="mt-2 text-[14px] text-muted">{tr("deadlines.none")}</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {pending.map((l) => {
                    const d = new Date(l.deadline_at!);
                    const days = Math.ceil((d.getTime() - today) / 86_400_000);
                    const late = days < 0;
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-3 text-[14px]">
                        <Link href={`/cartas/${l.id}`} className="truncate font-medium text-ink underline-offset-4 hover:underline">{l.host}</Link>
                        <span className={"shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold " + (late ? "bg-danger text-black" : days <= 3 ? "bg-warn text-black" : "bg-surface-2 text-muted")}>
                          {late ? tr("deadlines.overdueShort") : days === 0 ? tr("deadlines.today") : tr("deadlines.daysLeft", { n: days })} · {fmt.format(d)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Cartas */}
            <section className={CARD}>
              <h2 className="text-[16px] font-semibold text-ink">{tr("letters.listTitle")}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{tr("tools.lettersBody")}</p>
              {letters.length === 0 ? (
                <p className="mt-3 text-[14px] text-muted">{tr("letters.listEmpty")}</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {letters.slice(0, 8).map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-surface-2 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ink">{l.host}</p>
                        <p className="text-[12px] text-faint">
                          {isRemoved(l) && <span className="mr-1.5 font-semibold text-accent">{tr("removals.badge")}</span>}
                          {tr(`letters.status.${l.status}`)}
                          {l.status === "sent" && l.deadline_at && ` · ${tr("letters.deadline", { date: fmt.format(new Date(l.deadline_at)) })}`}
                        </p>
                      </div>
                      <Link href={`/cartas/${l.id}`} className={"shrink-0 " + LINK}>{tr("letters.open")}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
