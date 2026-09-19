import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";
import { supabaseAdmin } from "@/lib/supabase";
import { assistantsConfigured, AI_RECTIFY } from "@/lib/assistants";
import { backfillSnapshots, knowledgeLevel, type Snapshot, type WatchProvider } from "@/lib/ai-watch";
import { changeLine } from "@/lib/ai-watch-lines";

export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: tr("aiWatch.title"), robots: { index: false } };
}

const PROVIDERS: WatchProvider[] = ["perplexity", "openai", "gemini"];
const CARD = "min-w-0 overflow-hidden card p-5 sm:p-6";
const SECTION_LABEL = "px-1 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted";

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** Memoria de la IA: que dice hoy cada asistente, cuanto sabe y como ha cambiado en el tiempo. */
export default async function AiMemoryPage({ searchParams }: { searchParams: Promise<{ hoy?: string }> }) {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  if (!session) redirect("/entrar?next=/ia");
  const user = await findUserByEmail(session.email);
  if (!user) redirect("/entrar?next=/ia");
  const pro = isPro(user);
  const { hoy } = await searchParams;

  // Informes anteriores a esta funcion (o a la cuenta): se les hace la foto ahora, una sola vez.
  const load = () => supabaseAdmin()
    .from("ai_snapshots")
    .select("id, request_id, source, answers, facts, changes, taken_at")
    .eq("user_id", user.id)
    .order("taken_at", { ascending: false })
    .limit(24)
    .returns<Snapshot[]>();
  let { data } = await load();
  // Informes anteriores a esta funcion (o a la cuenta) no tienen foto. Si no hay ninguna, se hace una ahora (la mas
  // reciente) para no enseñar la pagina vacia; el resto se rellena despues de responder, sin bloquear la carga.
  if (!data || data.length === 0) {
    await backfillSnapshots(user.id, 1).catch(() => 0);
    ({ data } = await load());
  }
  const uid = user.id;
  after(() => backfillSnapshots(uid, 3).then(() => undefined, () => undefined));
  const snaps = data ?? [];
  const latest = snaps[0] ?? null;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const configured = new Set<WatchProvider>(["perplexity", ...assistantsConfigured()]);
  const missing = PROVIDERS.filter((p) => !latest?.facts[p] && !configured.has(p)).map((p) => tr(`aiWatch.providers.${p}`));

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page @container py-9 sm:py-14">
        <p className="eyebrow">{tr("aiWatch.eyebrow")}</p>
        <h1 className="h1 mt-2.5 text-ink">{tr("aiWatch.title")}</h1>
        <p className="lead mt-3 max-w-[64ch] !text-[15.5px]">{tr("aiWatch.subtitle")}</p>

        <div className={"card mt-6 flex flex-wrap items-center gap-3 px-5 py-4 " + (pro && user.monitoring ? "card-accent" : "")}>
          <p className="min-w-0 flex-1 basis-[220px] text-[14px] leading-relaxed text-muted">
            {pro && user.monitoring ? <><span className="dot dot-live mr-2.5 inline-block align-middle text-accent" aria-hidden="true" /><span className="font-semibold text-ink">{tr("aiWatch.watchOn")}</span></> : tr("aiWatch.watchOff")}
            {hoy && <span className="mt-1 block text-warn">{tr("aiWatch.checkedToday")}</span>}
          </p>
          {pro ? (
            <form action="/api/ai-watch" method="post" className="w-full shrink-0 sm:w-auto">
              <button type="submit" className="btn btn-primary w-full sm:w-auto">{tr("aiWatch.checkNow")}</button>
            </form>
          ) : (
            <Link href="/pro" className="btn btn-primary w-full shrink-0 sm:w-auto">{tr("aiWatch.watchCta")}</Link>
          )}
        </div>

        {!latest ? (
          <section className={CARD + " mt-5"}>
            <p className="text-[15px] leading-relaxed text-muted">{tr("aiWatch.empty")}</p>
            <Link href="/#form" className="mt-4 btn btn-primary">{tr("aiWatch.emptyCta")}</Link>
          </section>
        ) : (
          <>
            <h2 className={"mt-9 " + SECTION_LABEL}>{tr("aiWatch.now")} · {fmt.format(new Date(latest.taken_at))}</h2>
            <div className="mt-3 grid gap-4 @[840px]:grid-cols-3">
              {PROVIDERS.map((p) => {
                const f = latest.facts[p];
                const level = knowledgeLevel(f);
                const answers = latest.answers.filter((a) => a.provider === p);
                const color = level >= 60 ? "!bg-danger" : level >= 30 ? "!bg-warn" : "";
                const textColor = level >= 60 ? "text-danger" : level >= 30 ? "text-warn" : "text-accent";
                return (
                  <section key={p} className={CARD + " rise flex flex-col"} style={{ animationDelay: `${PROVIDERS.indexOf(p) * 80}ms` }}>
                    <h3 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.015em] text-ink"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-[15px] text-accent" aria-hidden="true">{p === "openai" ? "◎" : p === "gemini" ? "✦" : "✳"}</span>{tr(`aiWatch.providers.${p}`)}</h3>
                    {!f ? (
                      <p className="mt-3 text-[14px] text-faint">{tr("aiWatch.notAsked")}</p>
                    ) : (
                      <>
                        <p className="mt-4 flex items-end justify-between gap-2 text-[13px] text-faint"><span>{tr("aiWatch.knows")}</span><span className={"num text-[28px] " + textColor}>{level}<span className="text-[13px] !font-medium !tracking-normal text-faint"> /100</span></span></p>
                        <div className="meter mt-2"><i className={color} style={{ width: `${Math.max(3, level)}%` }} /></div>
                        {!f.knows_you ? (
                          <p className="chip tone-ok mt-4 w-fit">{tr("aiWatch.knowsNothing")}</p>
                        ) : (
                          <dl className="mt-4 grid gap-x-6 gap-y-2 text-[14px] @[520px]:grid-cols-2 @[840px]:grid-cols-1">
                            {f.employer && <div className="flex gap-3"><dt className="w-[72px] shrink-0 text-faint">{tr("aiWatch.fields.employer")}</dt><dd className="min-w-0 break-words text-ink">{f.employer}</dd></div>}
                            {f.role && <div className="flex gap-3"><dt className="w-[72px] shrink-0 text-faint">{tr("aiWatch.fields.role")}</dt><dd className="min-w-0 break-words text-ink">{f.role}</dd></div>}
                            {f.city && <div className="flex gap-3"><dt className="w-[72px] shrink-0 text-faint">{tr("aiWatch.fields.city")}</dt><dd className="min-w-0 break-words text-ink">{f.city}</dd></div>}
                            {f.contact.length > 0 && <div className="flex gap-3"><dt className="w-[72px] shrink-0 text-faint">{tr("aiWatch.fields.contact")}</dt><dd className="min-w-0 text-warn">{f.contact.map((c) => tr(`aiWatch.contact.${c}`)).join(", ")}</dd></div>}
                          </dl>
                        )}
                        {f.mixes_people && <p className="chip tone-warn mt-3 w-fit !whitespace-normal">{tr("aiWatch.fields.mixes")}</p>}
                        {f.claims.length > 0 && <ul className="mt-4 grid gap-1.5 border-t border-line pt-3">{f.claims.slice(0, 4).map((c) => <li key={c} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted"><span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-faint" />{c}</li>)}</ul>}
                        {answers.length > 0 && (
                          <details className="acc mt-3">
                            <summary className="link inline-flex min-h-[44px] items-center text-[13.5px]">{tr("aiWatch.literal")}</summary>
                            {answers.map((a, i) => (
                              <div key={i} className="acc-body tile mt-2 p-3.5">
                                <p className="text-[13px] font-medium text-faint">{a.question}</p>
                                <blockquote className="mt-2 whitespace-pre-line border-l-2 border-accent pl-3 text-[14px] leading-[1.65] text-[#c9c9c4]">{a.answer}</blockquote>
                                {a.sources.length > 0 && <p className="mt-2 break-words text-[12.5px] text-faint">{tr("aiWatch.sources")}: {a.sources.slice(0, 4).map((s) => hostOf(s.url)).join(" · ")}</p>}
                              </div>
                            ))}
                          </details>
                        )}
                        {f.knows_you && (
                          <div className="mt-auto pt-4">
                            {pro && latest.request_id ? (
                              <form action="/api/ai-requests" method="post">
                                <input type="hidden" name="request_id" value={latest.request_id} />
                                <input type="hidden" name="provider" value={p} />
                                <button type="submit" className="btn btn-secondary btn-sm w-full">{tr("aiWatch.rectify")}</button>
                              </form>
                            ) : (
                              <a href={AI_RECTIFY[p].url} target="_blank" rel="noreferrer nofollow" className="btn btn-secondary btn-sm w-full">{tr("aiWatch.rectify")}</a>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
            {missing.length > 0 && <p className="note mt-3 px-1">{tr("aiWatch.missing", { list: missing.join(", ") })}</p>}

            <h2 className={"mt-10 " + SECTION_LABEL}>{tr("aiWatch.timeline")}</h2>
            <ol className="relative mt-4 grid gap-3 pl-7 before:absolute before:bottom-4 before:left-[9px] before:top-4 before:w-px before:bg-gradient-to-b before:from-accent/60 before:via-line-strong before:to-transparent">
              {snaps.map((s, i) => {
                const isFirst = i === snaps.length - 1;
                return (
                  <li key={s.id} className={CARD + " relative !overflow-visible !p-4 sm:!p-5"}>
                    <span aria-hidden="true" className={"absolute -left-[25px] top-[22px] h-[11px] w-[11px] rounded-full border-2 border-paper " + (s.changes.some((c) => !c.minor && c.worse) ? "bg-warn" : s.changes.some((c) => !c.minor) ? "bg-accent" : "bg-line-strong") + (i === 0 ? " shadow-[0_0_0_4px_rgb(77_252_95/0.15)]" : "")} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[15px] font-semibold text-ink">{fmt.format(new Date(s.taken_at))}</p>
                      <span className="chip !py-1 !text-[12px]">{tr(s.source === "watch" ? "aiWatch.sourceWatch" : "aiWatch.sourceReport")}</span>
                    </div>
                    {s.changes.length === 0 ? (
                      <p className="mt-1.5 text-[14px] text-muted">{tr(isFirst ? "aiWatch.first" : "aiWatch.noChanges")}</p>
                    ) : (
                      <ul className="mt-3 grid gap-2">
                        {s.changes.map((c, j) => (
                          <li key={j} className="flex gap-2.5 text-[14.5px] leading-relaxed">
                            <span className={"mt-[7px] h-2 w-2 shrink-0 rounded-full " + (c.minor ? "bg-faint" : c.worse ? "bg-warn" : "bg-accent")} />
                            <span className={c.minor ? "text-muted" : "text-ink"}>{changeLine(c, locale)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.request_id && <Link href={`/informe/${s.request_id}`} className="link mt-2 inline-flex min-h-[44px] items-center text-[13.5px]">{tr("experience.viewReport")}</Link>}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
