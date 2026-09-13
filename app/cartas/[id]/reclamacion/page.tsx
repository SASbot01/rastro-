import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CopyButton } from "@/components/CopyButton";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { buildComplaint } from "@/lib/letters";
import type { Finding } from "@/lib/report/findings";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Letter {
  id: string;
  request_id: string | null;
  finding_index: number | null;
  host: string;
  target_url: string;
  contact: string | null;
  locale: string;
  status: string;
  sent_at: string | null;
  deadline_at: string | null;
  follow_up_sent_at: string | null;
  reply_note: string | null;
  outcome: "deleted" | "refused" | "partial" | null;
  requests: { email: string; full_name: string; city: string | null } | { email: string; full_name: string; city: string | null }[] | null;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Escrito de reclamacion ante la AEPD, generado al vuelo a partir de la
 * carta (no se guarda: cambia con la fecha). Solo cuando ha pasado el mes
 * sin respuesta o la persona lo ha marcado asi.
 */
export default async function ComplaintPage({ params }: PageProps<"/cartas/[id]/reclamacion">) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/entrar");
  const user = await findUserByEmail(session.email);
  if (!user) redirect("/entrar");
  if (!UUID.test(id)) redirect("/cuenta");

  const supabase = supabaseAdmin();
  const { data: letter } = await supabase
    .from("letters")
    .select("id, request_id, finding_index, host, target_url, contact, locale, status, sent_at, deadline_at, follow_up_sent_at, reply_note, outcome, requests(email, full_name, city)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<Letter>();
  if (!letter) redirect("/cuenta");

  const locale: Locale = isLocale(letter.locale) ? letter.locale : await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  const ready =
    Boolean(letter.sent_at && letter.deadline_at) &&
    (letter.status === "no_answer" ||
      (letter.status === "answered" && letter.outcome === "refused") ||
      (letter.status === "sent" && new Date(letter.deadline_at!) < new Date()));

  const req = one(letter.requests);
  let what = letter.host;
  if (letter.request_id && letter.finding_index !== null) {
    const { data: report } = await supabase.from("reports").select("findings").eq("request_id", letter.request_id).maybeSingle<{ findings: Finding[] }>();
    what = report?.findings?.[letter.finding_index]?.title ?? what;
  }

  const complaint =
    ready && req
      ? buildComplaint({
          fullName: req.full_name,
          email: req.email,
          city: req.city,
          host: letter.host,
          url: letter.target_url,
          what,
          locale,
          contact: letter.contact,
          sentAt: letter.sent_at!,
          deadlineAt: letter.deadline_at!,
          followUpAt: letter.follow_up_sent_at,
          replyNote: letter.reply_note,
          outcome: letter.outcome,
        })
      : null;

  const steps = (messages.aepd.steps as string[]).map((s) =>
    s.replace("{host}", letter.host).replace("{contact}", letter.contact ? ` (${letter.contact})` : ""),
  );

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-10 sm:py-14">
        <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-ink">{tr("aepd.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("aepd.subtitle", { host: letter.host })}</p>

        {!complaint ? (
          <p className="mt-6 rounded-[10px] bg-accent-soft px-4 py-3 text-[14px] leading-relaxed text-accent">{tr("aepd.notYet")}</p>
        ) : (
          <>
            <section className="mt-6 rounded-card border border-line bg-surface p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("aepd.text")}</h2>
              <pre className="mt-2 whitespace-pre-wrap rounded-[10px] bg-paper p-4 font-sans text-[14px] leading-[1.7] text-ink">{complaint}</pre>
              <div className="mt-4">
                <CopyButton text={complaint} label={tr("aepd.copy")} doneLabel={tr("aepd.copied")} />
              </div>
            </section>

            <section className="mt-4 rounded-card border border-line bg-surface p-5">
              <h2 className="text-[15px] font-semibold text-ink">{tr("aepd.guideTitle")}</h2>
              <ol className="mt-4 grid gap-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-muted">
                    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-black">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <h3 className="mt-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("aepd.attachments")}</h3>
              <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-[14px] leading-relaxed text-muted">
                <li>{tr("aepd.attach1", { sent: fmt.format(new Date(letter.sent_at!)) })}</li>
                <li>{tr("aepd.attach2")}</li>
                <li>{tr("aepd.attach3")}</li>
              </ul>
            </section>
          </>
        )}

        <Link href={`/cartas/${letter.id}`} className="mt-8 inline-block text-[14px] font-medium text-accent underline underline-offset-4">
          {tr("aepd.back")}
        </Link>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
