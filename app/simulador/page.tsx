import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { isPro } from "@/lib/plan";
import type { Simulation } from "@/lib/ai/simulate";

export const dynamic = "force-dynamic";

const CARD = "rounded-card border border-line bg-surface p-5 sm:p-6";
const BTN = "inline-block rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90";

function levelOf(n: number): "low" | "medium" | "high" {
  return n < 35 ? "low" : n < 65 ? "medium" : "high";
}
const LEVEL_TEXT = { low: "text-accent", medium: "text-warn", high: "text-danger" } as const;
const LEVEL_HEX = { low: "#4dfc5f", medium: "#ffb020", high: "#ff5f5f" } as const;

/** v2 — Simulador de ataque personal: phishing a medida, llamada de estafa y facilidad para engañarte. */
export default async function SimulatorPage({ searchParams }: PageProps<"/simulador">) {
  const { e, ok } = await searchParams;
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const pro = isPro(user);
  const supabase = supabaseAdmin();

  let hasReport = false;
  let sim: { id: string; content: Simulation; sent_at: string | null; created_at: string } | null = null;
  if (user) {
    const { data: rep } = await supabase.from("reports").select("request_id, requests!inner(user_id, status)").eq("requests.user_id", user.id).eq("requests.status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle<{ request_id: string }>();
    hasReport = Boolean(rep);
    if (rep) {
      const { data } = await supabase.from("simulations").select("id, content, sent_at, created_at").eq("user_id", user.id).eq("request_id", rep.request_id).maybeSingle<{ id: string; content: Simulation; sent_at: string | null; created_at: string }>();
      sim = data;
    }
  }
  const s = sim?.content ?? null;
  const level = s ? levelOf(s.attackability) : "low";
  const visiblePhishing = s ? (pro ? s.phishing : s.phishing.slice(0, 1)) : [];

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-8 sm:py-12">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("sim.eyebrow")}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em] text-ink sm:text-[34px]">{tr("sim.title")}</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted">{tr("sim.subtitle")}</p>

        {e === "failed" && <p role="alert" className="mt-4 text-[13.5px] font-medium text-danger">{tr("sim.failed")}</p>}
        {ok === "sent" && <p className="mt-4 rounded-[12px] bg-accent-soft px-4 py-3 text-[14px] font-medium text-accent">{tr("sim.sentOk")}</p>}

        {!user ? (
          <section className={CARD + " mt-6"}>
            <p className="text-[15px] font-semibold text-ink">{tr("tools.loginTitle")}</p>
            <p className="mt-1 text-[14px] text-muted">{tr("tools.loginBody")}</p>
            <Link href="/entrar" className={"mt-4 " + BTN}>{tr("nav.login")}</Link>
          </section>
        ) : !hasReport ? (
          <section className={CARD + " mt-6"}>
            <p className="text-[15px] font-semibold text-ink">{tr("sim.noReportTitle")}</p>
            <p className="mt-1 text-[14px] text-muted">{tr("sim.noReportBody")}</p>
            <Link href="/#form" className={"mt-4 " + BTN}>{tr("account.newReport")}</Link>
          </section>
        ) : !s ? (
          <section className={CARD + " mt-6"}>
            <form action="/api/simulate" method="post">
              <input type="hidden" name="action" value="generate" />
              <button type="submit" className={BTN}>{tr("sim.generate")}</button>
              <p className="mt-2 text-[12.5px] text-faint">{tr("sim.generating")}</p>
            </form>
          </section>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            {/* Atacabilidad + defensas */}
            <div className="grid gap-4 lg:sticky lg:top-20">
              <section className={CARD}>
                <p className="text-[13px] text-muted">{tr("sim.attackability")}</p>
                <div className="mt-2 flex items-center gap-4">
                  <div className="relative h-[104px] w-[104px] shrink-0">
                    <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90" aria-hidden="true">
                      <circle cx="52" cy="52" r="46" fill="none" stroke="#262626" strokeWidth="9" />
                      <circle cx="52" cy="52" r="46" fill="none" stroke={LEVEL_HEX[level]} strokeWidth="9" strokeLinecap="round" strokeDasharray={2 * Math.PI * 46} strokeDashoffset={2 * Math.PI * 46 * (1 - s.attackability / 100)} />
                    </svg>
                    <span className={"absolute inset-0 flex items-center justify-center text-[30px] font-semibold tracking-[-0.04em] " + LEVEL_TEXT[level]}>{s.attackability}</span>
                  </div>
                  <div>
                    <p className={"text-[20px] font-semibold " + LEVEL_TEXT[level]}>{tr(`sim.attackLevel.${level}`)}</p>
                    <p className="text-[12px] text-faint">{s.attackability} {tr("sim.attackabilityOutOf")}</p>
                  </div>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{s.attackability_reason}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`/simulador/${sim!.id}/imagen?f=story`} target="_blank" rel="noreferrer" className="rounded-[10px] border border-line bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-ink hover:border-faint">{tr("sim.share")}</a>
                  {pro && (
                    <form action="/api/simulate" method="post"><input type="hidden" name="action" value="generate" /><button type="submit" className="rounded-[10px] border border-line bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-muted hover:text-ink">{tr("sim.regenerate")}</button></form>
                  )}
                </div>
                <p className="mt-2 text-[11.5px] text-faint">{tr("sim.shareHint")}</p>
              </section>
              <section className={CARD}>
                <h2 className="text-[15px] font-semibold text-ink">{tr("sim.defensesTitle")}</h2>
                <ol className="mt-3 grid gap-3">
                  {s.defenses.map((d, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-black">{i + 1}</span>
                      <div><p className="text-[14px] font-semibold text-ink">{d.title}</p><p className="mt-0.5 text-[13px] leading-relaxed text-muted">{d.detail}</p></div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            {/* Phishing + llamada */}
            <div className="grid gap-4">
              <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("sim.phishingTitle")}</h2>
              {visiblePhishing.map((p, i) => (
                <article key={i} className="overflow-hidden rounded-card border border-line bg-surface">
                  <div className="flex items-center justify-between gap-3 bg-accent px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-black">
                    <span>{tr("sim.tag")} · {tr(`sim.channel.${p.channel}`)}</span><span>{i + 1}/3</span>
                  </div>
                  <div className="p-5">
                    <p className="text-[12.5px] text-faint">{p.from_name} · {p.from_address}</p>
                    <p className="mt-1 text-[16px] font-semibold text-ink">{p.subject}</p>
                    <p className="mt-3 whitespace-pre-line rounded-[12px] bg-surface-2 p-4 text-[14px] leading-relaxed text-ink">{p.body}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-warn">{tr("sim.pretext")}</p><p className="mt-1 text-[13.5px] leading-relaxed text-muted">{p.pretext}</p></div>
                      <div><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("sim.clues")}</p><ul className="mt-1 grid gap-1">{p.clues.map((c) => <li key={c} className="flex gap-2 text-[13.5px] leading-relaxed text-muted"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{c}</li>)}</ul></div>
                    </div>
                  </div>
                </article>
              ))}

              {!pro ? (
                <section className="rounded-card border border-accent/40 bg-accent-soft p-5">
                  <p className="text-[15px] font-semibold text-ink">{tr("sim.lockedTitle")}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("sim.lockedBody")}</p>
                  <Link href="/pro" className={"mt-4 " + BTN}>{tr("pro.lockedCta")}</Link>
                </section>
              ) : (
                <>
                  <section className={CARD}>
                    <form action="/api/simulate" method="post">
                      <input type="hidden" name="action" value="send" />
                      <button type="submit" className={BTN}>{tr("sim.sendToMe")}</button>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-faint">{tr("sim.sendToMeHelp")}</p>
                    </form>
                  </section>
                  <h2 className="px-1 pt-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("sim.vishingTitle")}</h2>
                  <section className={CARD}>
                    <p className="text-[14px] leading-relaxed text-muted">{s.vishing.scenario}</p>
                    <p className="mt-2 text-[13px] text-faint">{tr("sim.callerClaims")}: <span className="text-ink">{s.vishing.caller_claims}</span></p>
                    <ol className="mt-4 grid gap-2">
                      {s.vishing.script.map((l, i) => (
                        <li key={i} className={"flex " + (l.who === "you" ? "justify-end" : "justify-start")}>
                          <p className={"max-w-[88%] rounded-[14px] px-3.5 py-2.5 text-[14px] leading-relaxed " + (l.who === "you" ? "bg-accent text-black" : "bg-surface-2 text-ink")}>
                            <span className="mr-1 text-[11px] font-semibold uppercase opacity-70">{tr(`sim.who.${l.who}`)}:</span> {l.line}
                          </p>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-warn">{tr("sim.redFlags")}</p><ul className="mt-1 grid gap-1">{s.vishing.red_flags.map((c) => <li key={c} className="flex gap-2 text-[13.5px] leading-relaxed text-muted"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />{c}</li>)}</ul></div>
                      <div><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("sim.hangUp")}</p><p className="mt-1 text-[13.5px] leading-relaxed text-ink">«{s.vishing.hang_up}»</p></div>
                    </div>
                  </section>
                </>
              )}
              <p className="px-1 text-[11.5px] leading-relaxed text-faint">{tr("sim.disclaimer")}</p>
            </div>
          </div>
        )}
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
