import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
const CARD = "min-w-0 overflow-hidden rounded-card border border-line bg-surface p-5 sm:p-6";

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
  await backfillSnapshots(user.id, 3).catch(() => 0);
  const { data } = await supabaseAdmin()
    .from("ai_snapshots")
    .select("id, request_id, source, answers, facts, changes, taken_at")
    .eq("user_id", user.id)
    .order("taken_at", { ascending: false })
    .limit(24)
    .returns<Snapshot[]>();
  const snaps = data ?? [];
  const latest = snaps[0] ?? null;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const configured = new Set<WatchProvider>(["perplexity", ...assistantsConfigured()]);
  const missing = PROVIDERS.filter((p) => !latest?.facts[p] && !configured.has(p)).map((p) => tr(`aiWatch.providers.${p}`));

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] px-5 py-10 sm:py-14 lg:max-w-[920px]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("aiWatch.eyebrow")}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink sm:text-[36px]">{tr("aiWatch.title")}</h1>
        <p className="mt-3 max-w-[64ch] text-[15.5px] leading-relaxed text-muted">{tr("aiWatch.subtitle")}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-5 py-4">
          <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-muted">
            {pro && user.monitoring ? <><span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent align-middle" /><span className="font-semibold text-ink">{tr("aiWatch.watchOn")}</span></> : tr("aiWatch.watchOff")}
            {hoy && <span className="mt-1 block text-warn">{tr("aiWatch.checkedToday")}</span>}
          </p>
          {pro ? (
            <form action="/api/ai-watch" method="post" className="shrink-0">
              <button type="submit" className="rounded-[12px] bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-black hover:opacity-90">{tr("aiWatch.checkNow")}</button>
            </form>
          ) : (
            <Link href="/pro" className="shrink-0 rounded-[12px] bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-black hover:opacity-90">{tr("aiWatch.watchCta")}</Link>
          )}
        </div>

        {!latest ? (
          <section className={CARD + " mt-5"}>
            <p className="text-[14.5px] text-muted">{tr("aiWatch.empty")}</p>
            <Link href="/#form" className="mt-4 inline-block rounded-[12px] bg-accent px-5 py-3 text-[14px] font-semibold text-black">{tr("aiWatch.emptyCta")}</Link>
          </section>
        ) : (
          <>
            <h2 className="mt-8 px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("aiWatch.now")} · {fmt.format(new Date(latest.taken_at))}</h2>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              {PROVIDERS.map((p) => {
                const f = latest.facts[p];
                const level = knowledgeLevel(f);
                const answers = latest.answers.filter((a) => a.provider === p);
                const color = level >= 60 ? "bg-danger" : level >= 30 ? "bg-warn" : "bg-accent";
                return (
                  <section key={p} className={CARD + " flex flex-col"}>
                    <h3 className="text-[16px] font-semibold text-ink">{tr(`aiWatch.providers.${p}`)}</h3>
                    {!f ? (
                      <p className="mt-2 text-[13.5px] text-faint">{tr("aiWatch.notAsked")}</p>
                    ) : (
                      <>
                        <p className="mt-3 flex items-baseline justify-between text-[12px] text-faint"><span>{tr("aiWatch.knows")}</span><span className="text-[15px] font-semibold text-ink">{level}<span className="text-faint">/100</span></span></p>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className={"h-full rounded-full " + color} style={{ width: `${Math.max(3, level)}%` }} /></div>
                        {!f.knows_you ? (
                          <p className="mt-3 text-[13.5px] font-medium text-accent">{tr("aiWatch.knowsNothing")}</p>
                        ) : (
                          <dl className="mt-3 grid gap-1.5 text-[13px]">
                            {f.employer && <div className="flex gap-2"><dt className="w-[72px] shrink-0 text-faint">{tr("aiWatch.fields.employer")}</dt><dd className="min-w-0 break-words text-ink">{f.employer}</dd></div>}
                            {f.role && <div className="flex gap-2"><dt className="w-[72px] shrink-0 text-faint">{tr("aiWatch.fields.role")}</dt><dd className="min-w-0 break-words text-ink">{f.role}</dd></div>}
                            {f.city && <div className="flex gap-2"><dt className="w-[72px] shrink-0 text-faint">{tr("aiWatch.fields.city")}</dt><dd className="min-w-0 break-words text-ink">{f.city}</dd></div>}
                            {f.contact.length > 0 && <div className="flex gap-2"><dt className="w-[72px] shrink-0 text-faint">{tr("aiWatch.fields.contact")}</dt><dd className="min-w-0 text-warn">{f.contact.map((c) => tr(`aiWatch.contact.${c}`)).join(", ")}</dd></div>}
                          </dl>
                        )}
                        {f.mixes_people && <p className="mt-2 text-[12.5px] text-warn">{tr("aiWatch.fields.mixes")}</p>}
                        {f.claims.length > 0 && <ul className="mt-3 grid gap-1">{f.claims.slice(0, 4).map((c) => <li key={c} className="flex gap-2 text-[12.5px] leading-relaxed text-muted"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-faint" />{c}</li>)}</ul>}
                        {answers.length > 0 && (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-[12.5px] font-medium text-accent">{tr("aiWatch.literal")}</summary>
                            {answers.map((a, i) => (
                              <div key={i} className="mt-2">
                                <p className="text-[12px] text-faint">{a.question}</p>
                                <blockquote className="mt-1 whitespace-pre-line border-l-2 border-accent pl-3 text-[12.5px] leading-relaxed text-muted">{a.answer}</blockquote>
                                {a.sources.length > 0 && <p className="mt-1 break-words text-[11.5px] text-faint">{tr("aiWatch.sources")}: {a.sources.slice(0, 4).map((s) => hostOf(s.url)).join(" · ")}</p>}
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
                                <button type="submit" className="text-[12.5px] font-medium text-accent underline underline-offset-4">{tr("aiWatch.rectify")}</button>
                              </form>
                            ) : (
                              <a href={AI_RECTIFY[p].url} target="_blank" rel="noreferrer nofollow" className="text-[12.5px] font-medium text-accent underline underline-offset-4">{tr("aiWatch.rectify")}</a>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
            {missing.length > 0 && <p className="mt-3 px-1 text-[12px] text-faint">{tr("aiWatch.missing", { list: missing.join(", ") })}</p>}

            <h2 className="mt-9 px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("aiWatch.timeline")}</h2>
            <ol className="mt-3 grid gap-3">
              {snaps.map((s, i) => {
                const isFirst = i === snaps.length - 1;
                return (
                  <li key={s.id} className={CARD + " !p-4 sm:!p-5"}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold text-ink">{fmt.format(new Date(s.taken_at))}</p>
                      <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11.5px] text-faint">{tr(s.source === "watch" ? "aiWatch.sourceWatch" : "aiWatch.sourceReport")}</span>
                    </div>
                    {s.changes.length === 0 ? (
                      <p className="mt-1.5 text-[13px] text-muted">{tr(isFirst ? "aiWatch.first" : "aiWatch.noChanges")}</p>
                    ) : (
                      <ul className="mt-2 grid gap-1.5">
                        {s.changes.map((c, j) => (
                          <li key={j} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                            <span className={"mt-[7px] h-2 w-2 shrink-0 rounded-full " + (c.minor ? "bg-faint" : c.worse ? "bg-warn" : "bg-accent")} />
                            <span className={c.minor ? "text-muted" : "text-ink"}>{changeLine(c, locale)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.request_id && <Link href={`/informe/${s.request_id}`} className="mt-2 inline-block text-[12.5px] font-medium text-accent underline underline-offset-4">{tr("experience.viewReport")}</Link>}
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
