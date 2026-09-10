import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CopyButton } from "@/components/CopyButton";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";

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

export default async function LetterPage({ params }: PageProps<"/cartas/[id]">) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/entrar");
  const user = await findUserByEmail(session.email);
  if (!user) redirect("/entrar");

  const { data: letter } = UUID.test(id)
    ? await supabaseAdmin()
        .from("letters")
        .select("id, request_id, host, target_url, contact, contact_source, subject, body, locale, status, sent_at, deadline_at")
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

  const isUrlContact = letter.contact?.startsWith("http");

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

        {/* Estado y plazos */}
        <section className="mt-4 rounded-card border border-line bg-surface p-5">
          {letter.status === "draft" && (
            <>
              <StatusButton id={letter.id} status="sent" label={tr("letters.markSent")} primary />
              <p className="mt-2 text-[12.5px] leading-relaxed text-faint">{tr("letters.markSentHelp")}</p>
            </>
          )}
          {letter.status !== "draft" && letter.sent_at && (
            <p className="text-[14px] text-ink">
              {tr("letters.sentOn", { date: fmt.format(new Date(letter.sent_at)) })}
              {letter.deadline_at && <span className="text-muted"> · {tr("letters.deadline", { date: fmt.format(new Date(letter.deadline_at)) })}</span>}
            </p>
          )}
          {letter.status === "sent" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusButton id={letter.id} status="answered" label={tr("letters.markAnswered")} primary />
              <StatusButton id={letter.id} status="no_answer" label={tr("letters.markNoAnswer")} />
            </div>
          )}
          {/* Reclamacion AEPD: sin respuesta, o enviada con el plazo vencido */}
          {(letter.status === "no_answer" || (letter.status === "sent" && letter.deadline_at && new Date(letter.deadline_at) < new Date())) && (
            <Link
              href={`/cartas/${letter.id}/reclamacion`}
              className="mt-4 inline-block rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90"
            >
              {tr("aepd.cta")}
            </Link>
          )}
          {(letter.status === "answered" || letter.status === "no_answer") && (
            <div className="mt-4">
              <StatusButton id={letter.id} status="draft" label={tr("letters.reopen")} />
            </div>
          )}
        </section>

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
