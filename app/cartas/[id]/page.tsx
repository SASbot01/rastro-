import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CopyButton } from "@/components/CopyButton";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import type { LetterEvent } from "@/lib/letters";
import { brokerForHost } from "@/lib/brokers/catalog";
import { AI_PROVIDERS, type AiProviderKey } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Letter {
  id: string;
  request_id: string | null;
  host: string;
  target_url: string;
  contact: string | null;
  contact_source: string | null;
  subject: string;
  body: string;
  locale: string;
  status: "draft" | "sent" | "answered" | "no_answer" | "closed";
  sent_at: string | null;
  deadline_at: string | null;
  sent_via: "user" | "rastro";
  follow_up_sent_at: string | null;
  reply_note: string | null;
  outcome: "deleted" | "refused" | "partial" | null;
  events: LetterEvent[] | null;
  last_check_at: string | null;
  still_listed: boolean | null;
  kind: "site" | "ai" | "image";
  provider: string | null;
}

const STATUS_CLASS: Record<Letter["status"], string> = {
  draft: "bg-paper text-muted",
  sent: "bg-accent-soft text-accent",
  answered: "bg-paper text-ok",
  no_answer: "bg-accent text-black",
  closed: "bg-paper text-faint",
};

function StatusButton({ id, status, label, primary }: { id: string; status: string; label: string; primary?: boolean }) {
  return (
    <form action={`/api/letters/${id}/status`} method="post">
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={
          primary
            ? "rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90"
            : "rounded-[10px] border border-line bg-surface px-4 py-3 text-[14px] font-medium text-ink hover:border-faint"
        }
      >
        {label}
      </button>
    </form>
  );
}

export default async function LetterPage({ params, searchParams }: PageProps<"/cartas/[id]">) {
  const { id } = await params;
  const { e: errorCode, ok } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/entrar");
  const user = await findUserByEmail(session.email);
  if (!user) redirect("/entrar");

  const { data: letter } = UUID.test(id)
    ? await supabaseAdmin()
        .from("letters")
        .select("id, request_id, host, target_url, contact, contact_source, subject, body, locale, status, sent_at, deadline_at, sent_via, follow_up_sent_at, reply_note, outcome, events, last_check_at, still_listed, kind, provider")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle<Letter>()
    : { data: null };

  // La carta se muestra en el idioma en que se redacto.
  const locale: Locale = letter && isLocale(letter.locale) ? letter.locale : await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  if (!letter) {
    return (
      <>
        <SiteHeader locale={locale} messages={messages} />
        <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-16">
          <h1 className="text-[24px] font-semibold text-ink">{tr("waiting.notFoundTitle")}</h1>
          <Link href="/cuenta" className="mt-6 inline-block text-[14px] font-medium text-accent underline underline-offset-4">
            {tr("nav.account")}
          </Link>
        </main>
        <SiteFooter messages={messages} />
      </>
    );
  }

  const aiProvider = letter.kind === "ai" && letter.provider && letter.provider in AI_PROVIDERS ? AI_PROVIDERS[letter.provider as AiProviderKey] : null;
  const known = aiProvider ? null : brokerForHost(letter.host);
  const isUrlContact = letter.contact?.startsWith("http");
  const emailContact = letter.contact && !isUrlContact ? letter.contact : "";
  const fmtShort = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const expired = letter.status === "sent" && letter.deadline_at && new Date(letter.deadline_at) < new Date();
  const canComplain = letter.status === "no_answer" || expired || (letter.status === "answered" && letter.outcome === "refused");
  const FIELD = "w-full rounded-[12px] border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-faint focus:border-accent focus:outline-none";

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-ink">{tr("letters.title")}</h1>
          <span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide " + STATUS_CLASS[letter.status]}>
            {tr(`letters.status.${letter.status}`)}
          </span>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("letters.subtitle", { host: letter.host })}</p>

        {/* Destinatario */}
        <section className="mt-6 rounded-card border border-line bg-surface p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("letters.recipient")}</h2>
          <p className="mt-2 text-[15px] font-semibold text-ink">{letter.host}</p>
          <a href={letter.target_url} target="_blank" rel="noreferrer nofollow" className="mt-1 block truncate text-[13px] text-accent underline underline-offset-4">
            {letter.target_url}
          </a>
          {letter.contact ? (
            <div className="mt-4">
              <p className="text-[12.5px] text-faint">{tr("letters.contactFound")}</p>
              {isUrlContact ? (
                <a href={letter.contact} target="_blank" rel="noreferrer nofollow" className="mt-0.5 block break-all text-[15px] font-semibold text-ink underline underline-offset-4">
                  {letter.contact}
                </a>
              ) : (
                <a href={`mailto:${letter.contact}?subject=${encodeURIComponent(letter.subject)}`} className="mt-0.5 block text-[15px] font-semibold text-ink underline underline-offset-4">
                  {letter.contact}
                </a>
              )}
              {letter.contact_source && (
                <p className="mt-1 truncate text-[12px] text-faint">
                  {tr("letters.contactSource")}: {letter.contact_source}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-[13px] leading-relaxed text-muted">{tr("letters.contactNotFound")}</p>
          )}
        </section>

        {/* Proveedor de IA: pasos del portal de derechos */}
        {aiProvider && (
          <section className="mt-4 rounded-card border border-accent/40 bg-accent-soft p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("aiReq.steps", { provider: aiProvider.name })}</h2>
            <ol className="mt-3 grid gap-2">
              {aiProvider.steps.map((st, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-ink">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-black">{i + 1}</span>
                  {st}
                </li>
              ))}
            </ol>
            <a href={aiProvider.url} target="_blank" rel="noreferrer nofollow" className="mt-3 inline-block text-[13px] font-medium text-accent underline underline-offset-4">{aiProvider.url}</a>
          </section>
        )}

        {/* Tramite conocido (catalogo) */}
        {known && (
          <section className="mt-4 rounded-card border border-accent/40 bg-accent-soft p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("sites.letterKnown", { name: known.name })}</h2>
            <ol className="mt-3 grid gap-2">
              {known.steps.map((st, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-ink">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-black">{i + 1}</span>
                  {st}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[12.5px] text-muted">
              {known.typicalDays === 0 ? tr("sites.typicalInstant") : known.typicalDays ? tr("sites.typical", { n: known.typicalDays }) : ""}
              {" · "}
              <Link href={`/sitios/${known.slug}`} className="text-accent underline underline-offset-4">{tr("sites.seeGuide")}</Link>
            </p>
          </section>
        )}

        {/* Carta */}
        <section className="mt-4 rounded-card border border-line bg-surface p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("letters.subject")}</h2>
          <p className="mt-1.5 text-[15px] font-semibold text-ink">{letter.subject}</p>
          <h2 className="mt-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("letters.body")}</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded-[10px] bg-paper p-4 font-sans text-[14px] leading-[1.7] text-ink">{letter.body}</pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton text={`${letter.subject}\n\n${letter.body}`} label={tr("letters.copy")} doneLabel={tr("letters.copied")} />
          </div>
        </section>

        {/* Enviar / estado y plazos */}
        <section className="mt-4 rounded-card border border-line bg-surface p-5">
          {ok === "sent" && <p className="mb-4 rounded-[12px] bg-accent-soft px-4 py-3 text-[14px] font-medium text-accent">{tr("letters.event.sent_by_rastro", { to: letter.contact ?? "" })}</p>}
          {errorCode === "to" && <p role="alert" className="mb-4 text-[13px] font-medium text-danger">{tr("formErrors.email")}</p>}
          {errorCode === "send" && <p role="alert" className="mb-4 text-[13px] font-medium text-danger">{tr("formErrors.generic")}</p>}

          {letter.status === "draft" && (
            <>
              {isUrlContact ? (
                <p className="text-[14px] leading-relaxed text-muted">{tr("letters.formContact")}</p>
              ) : (
                <form action={`/api/letters/${letter.id}/send`} method="post" className="grid gap-3">
                  <label className="text-[13px] font-medium text-ink" htmlFor="to">{tr("letters.toLabel")}</label>
                  <input id="to" name="to" type="email" required defaultValue={emailContact} placeholder={tr("letters.toPlaceholder")} className={FIELD} />
                  <p className="-mt-1 text-[12px] text-faint">{tr("letters.toHelp")}</p>
                  <button type="submit" className="w-fit rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90">{tr("letters.sendByRastro")}</button>
                  <p className="text-[12.5px] leading-relaxed text-faint">{tr("letters.sendByRastroHelp")}</p>
                </form>
              )}
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-[13px] text-muted">{tr("letters.orManual")}</p>
                <StatusButton id={letter.id} status="sent" label={tr("letters.markSent")} primary={Boolean(isUrlContact)} />
                <p className="mt-2 text-[12.5px] leading-relaxed text-faint">{tr("letters.markSentHelp")}</p>
              </div>
            </>
          )}

          {letter.status !== "draft" && letter.sent_at && (
            <p className="text-[14px] text-ink">
              {tr("letters.sentOn", { date: fmt.format(new Date(letter.sent_at)) })}
              <span className="text-muted"> · {tr(letter.sent_via === "rastro" ? "letters.sentByRastro" : "letters.sentByUser")}</span>
              {letter.deadline_at && <span className="text-muted"> · {tr("letters.deadline", { date: fmt.format(new Date(letter.deadline_at)) })}</span>}
              {letter.follow_up_sent_at && <span className="text-muted"> · {tr("letters.followUpOn", { date: fmt.format(new Date(letter.follow_up_sent_at)) })}</span>}
            </p>
          )}

          {letter.status === "sent" && (
            <details className="group mt-4 rounded-[14px] border border-line bg-surface-2 p-4">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">{tr("letters.replyTitle")}</summary>
              <p className="mt-1 text-[13px] text-muted">{tr("letters.replyBody")}</p>
              <form action={`/api/letters/${letter.id}/status`} method="post" className="mt-3 grid gap-2">
                <input type="hidden" name="status" value="answered" />
                {(["deleted", "partial", "refused"] as const).map((o) => (
                  <label key={o} className="flex items-center gap-2 text-[14px] text-ink">
                    <input type="radio" name="outcome" value={o} required className="accent-[#4dfc5f]" />
                    {tr(`letters.outcome.${o}`)}
                  </label>
                ))}
                <textarea name="reply_note" rows={4} maxLength={4000} placeholder={tr("letters.replyNote")} className={FIELD + " mt-1"} />
                <button type="submit" className="w-fit rounded-[12px] bg-accent px-5 py-2.5 text-[14px] font-semibold text-black hover:opacity-90">{tr("letters.replySubmit")}</button>
              </form>
              <div className="mt-3 border-t border-line pt-3">
                <StatusButton id={letter.id} status="no_answer" label={tr("letters.markNoAnswer")} />
              </div>
            </details>
          )}

          {letter.status === "closed" && (
            <div className="mt-3 rounded-[14px] bg-accent-soft p-4">
              <p className="text-[15px] font-semibold text-accent">{tr("letters.successTitle")}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink">{tr("letters.successBody", { host: letter.host })}</p>
            </div>
          )}
          {letter.status === "answered" && letter.outcome && (
            <div className="mt-3 rounded-[14px] border border-line bg-surface-2 p-4">
              <p className="text-[14px] font-semibold text-ink">{tr(`letters.outcomeLabel.${letter.outcome}`)}</p>
              {letter.reply_note && <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted">{letter.reply_note}</p>}
              {letter.outcome === "refused" && <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{tr("letters.refusedBody")}</p>}
            </div>
          )}

          {canComplain && (
            <Link href={`/cartas/${letter.id}/reclamacion`} className="mt-4 inline-block rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90">
              {tr("aepd.cta")}
            </Link>
          )}
          {(letter.status === "answered" || letter.status === "no_answer" || letter.status === "closed") && (
            <div className="mt-4">
              <StatusButton id={letter.id} status="draft" label={tr("letters.reopen")} />
            </div>
          )}
        </section>

        {/* Comprobacion de resultado */}
        {letter.status !== "draft" && (
          <section className="mt-4 rounded-card border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("letters.checkTitle")}</h2>
                {letter.last_check_at ? (
                  <p className={"mt-1.5 text-[14px] font-semibold " + (letter.still_listed === false ? "text-accent" : letter.still_listed ? "text-warn" : "text-muted")}>
                    {letter.still_listed === false ? tr("letters.checkGone") : letter.still_listed ? tr("letters.checkStill") : tr("letters.checkUnknown")}
                    <span className="ml-2 text-[12px] font-normal text-faint">{fmtShort.format(new Date(letter.last_check_at))}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-muted">{tr("letters.checkBody")}</p>
                )}
              </div>
              <form action={`/api/letters/${letter.id}/check`} method="post">
                <button type="submit" className="rounded-[10px] border border-line bg-surface-2 px-4 py-2.5 text-[14px] font-medium text-ink hover:border-faint">{tr("letters.checkNow")}</button>
              </form>
            </div>
          </section>
        )}

        {/* Cronologia (pruebas) */}
        {letter.events && letter.events.length > 0 && (
          <section className="mt-4 rounded-card border border-line bg-surface p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("letters.timeline")}</h2>
            <ol className="mt-3 grid gap-2.5">
              {letter.events.map((ev, i) => (
                <li key={i} className="flex gap-3 text-[14px]">
                  <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + (ev.type === "closed" ? "bg-accent" : ev.type === "reminder" || ev.type === "no_answer" ? "bg-warn" : "bg-faint")} />
                  <span className="min-w-0">
                    <span className="block text-ink">{tr(`letters.event.${ev.type}`, { to: ev.to ?? "" })}</span>
                    <span className="block text-[12px] text-faint">{fmtShort.format(new Date(ev.at))}</span>
                  </span>
                </li>
              ))}
            </ol>
            {letter.sent_at && (
              <p className="mt-3 text-[12.5px] text-faint">
                {tr("letters.evidence", { followUp: letter.follow_up_sent_at ? tr("letters.evidenceFollowUp") : "", reply: letter.reply_note ? tr("letters.evidenceReply") : "" })}
              </p>
            )}
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-5 text-[14px]">
          {letter.request_id && (
            <Link href={`/informe/${letter.request_id}`} className="font-medium text-accent underline underline-offset-4">
              {tr("letters.back")}
            </Link>
          )}
          <Link href="/cuenta" className="font-medium text-muted underline underline-offset-4 hover:text-ink">
            {tr("nav.account")}
          </Link>
        </div>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
