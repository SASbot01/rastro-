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

const CARD = "card p-5 sm:p-6";
const BTN = "btn btn-primary btn-sm";
const LINK = "link text-[14px]";

/* Accesos del hub: cada uno con su icono. Los textos salen de messages. */
const TOOLS: Array<{ href: string; eyebrow: string; title: string; body: string; icon: string; danger?: boolean }> = [
  { href: "/ayuda-urgente", eyebrow: "experience.emergency", title: "experience.emergencyTitle", body: "experience.emergencyBody", icon: "M12 4 3.5 19h17L12 4zM12 10v4.5M12 17v.01", danger: true },
  { href: "/ia", eyebrow: "aiWatch.eyebrow", title: "aiWatch.hubTitle", body: "aiWatch.hubBody", icon: "M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9L12 3.5zM18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8.8-1.9z" },
  { href: "/simulador", eyebrow: "sim.eyebrow", title: "sim.title", body: "sim.hubBody", icon: "M4 6.5h16v9H9l-5 4v-13zM8.5 10.5h7M8.5 13h4" },
  { href: "/imagenes", eyebrow: "images.eyebrow", title: "images.title", body: "images.hubBody", icon: "M4 5.5h16v13H4zM4 15l4.5-4.5 4 4 2.5-2.5 5 5M15 9.5v.01" },
  { href: "/extension", eyebrow: "ext.eyebrow", title: "ext.title", body: "ext.hubBody", icon: "M9 4.5h6v3a2 2 0 1 0 4 0V7h.5v6H17a2 2 0 1 0 0 4h2.5v2.5h-15V14H7a2 2 0 1 0 0-4H4.5V4.5H9z" },
  { href: "/guardian", eyebrow: "guardian.eyebrow", title: "guardian.title", body: "sim.guardianHubBody", icon: "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3zM9 12l2 2 4-4" },
];

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
      <main className="page py-8 sm:py-12">
        <p className="eyebrow">{pro ? tr("pro.badge") : tr("tools.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("tools.title")}</h1>
        <p className="lead mt-2 !text-[15.5px]">{tr("tools.subtitle")}</p>

        {/* v2 y v3: para todos (gratis con limite; Pro completo) */}
        <ul className="mt-7 grid gap-3 sm:grid-cols-2">
          {TOOLS.map((t, i) => (
            <li key={t.href} className="rise" style={{ animationDelay: `${i * 50}ms` }}>
              <Link href={t.href} className={"card card-link group flex h-full items-start gap-4 p-5 " + (t.danger ? "!border-danger/30 hover:!border-danger/70" : "hover:!border-accent/50")}>
                <span className={"icon-tile " + (t.danger ? "!bg-danger/10 !text-danger !shadow-[inset_0_0_0_1px_rgb(255_95_95/0.25)]" : "")} aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]"><path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={"eyebrow block !text-[11.5px] " + (t.danger ? "!text-danger" : "")}>{tr(t.eyebrow)}</span>
                  <span className="h3 mt-1 block text-ink">{tr(t.title)}</span>
                  <span className="mt-1.5 block text-[14px] leading-relaxed text-muted">{tr(t.body)}</span>
                </span>
                <svg viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true"><path d="m7.5 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            </li>
          ))}
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
                  <h2 className="h3 text-ink">{t}</h2>
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
                <h2 className="h3 text-ink">{tr("monitor.title")}</h2>
                <span className={"badge uppercase " + (user.monitoring ? "tone-ok" : "")}>{user.monitoring && <span className="dot dot-live !h-1.5 !w-1.5" aria-hidden="true" />}
                  {user.monitoring ? tr("monitor.on") : tr("monitor.off")}
                </span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{tr("monitor.body")}</p>
              {user.monitoring && user.monitor_last_at && (
                <p className="mt-2 text-[12.5px] text-faint">{tr("monitor.nextCheck", { date: fmt.format(new Date(new Date(user.monitor_last_at).getTime() + 30 * 86_400_000)) })}</p>
              )}
              <form action="/api/monitor" method="post" className="mt-4 grid gap-2">
                <input type="hidden" name="enabled" value={user.monitoring ? "0" : "1"} />
                <button type="submit" className={user.monitoring ? "w-fit link-muted text-[14px]" : "w-fit " + BTN}>
                  {user.monitoring ? tr("monitor.disable") : tr("monitor.enable")}
                </button>
                {!user.monitoring && <p className="text-[12px] leading-relaxed text-faint">{tr("monitor.consent")}</p>}
              </form>
            </section>

            {/* Escaner de buzon */}
            <section className={CARD}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="h3 text-ink">{tr("mailbox.title")}</h2>
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
              <h2 className="h3 text-ink">{tr("deadlines.title")}</h2>
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
              <h2 className="h3 text-ink">{tr("letters.listTitle")}</h2>
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
