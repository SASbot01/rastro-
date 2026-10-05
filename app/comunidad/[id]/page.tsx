import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/domain-report";
import { getThread, type ReplyRow } from "@/lib/forum";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getThread(id);
  if (!data) return { title: "Rastro" };
  return { title: `${data.thread.title} — Rastro`, robots: { index: false } };
}

export default async function ThreadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string }> }) {
  const { id } = await params;
  const { e } = await searchParams;
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const admin = session ? isAdminEmail(session.email) : false;
  const data = await getThread(id);
  if (!data) notFound();
  const { thread, replies } = data;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  const Author = ({ name, official, date }: { name: string | null; official: boolean; date: string }) => (
    <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-faint">
      <span className="font-semibold text-muted">{name ?? "—"}</span>
      {official && <span className="badge tone-ok">{tr("forum.official")}</span>}
      <span>· {fmt.format(new Date(date))}</span>
    </p>
  );

  const Actions = ({ type, pid }: { type: "thread" | "reply"; pid: string }) => (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {session && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[12.5px] text-faint hover:text-muted [&::-webkit-details-marker]:hidden">{tr("forum.report")}</summary>
          <form action="/api/forum" method="post" className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="action" value="report" />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="id" value={pid} />
            <input type="hidden" name="back" value={`/comunidad/${thread.id}`} />
            <input name="reason" maxLength={200} placeholder={tr("forum.reportReason")} className="field !min-h-[40px] !w-auto flex-1 !text-[13px]" />
            <button type="submit" className="btn btn-secondary btn-sm">{tr("forum.reportSend")}</button>
          </form>
        </details>
      )}
      {admin && (
        <form action="/api/forum/moderate" method="post">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="id" value={pid} />
          <input type="hidden" name="hidden" value="1" />
          <input type="hidden" name="back" value={`/comunidad/${thread.id}`} />
          <button type="submit" className="text-[12.5px] text-danger underline underline-offset-4">{tr("forum.moderateHide")}</button>
        </form>
      )}
    </div>
  );

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-8 sm:py-12">
        <Link href="/comunidad" className="link text-[14px]">← {tr("forum.title")}</Link>

        {e && (
          <p role="alert" className={"mt-4 rounded-[12px] px-4 py-3 text-[14px] " + (e === "reported" || e === "posted" ? "bg-accent-soft text-accent" : "bg-warn/10 text-warn")}>
            {tr(`forum.errors.${e}`)}
          </p>
        )}

        {/* Tema */}
        <article className="card mt-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">{tr(`forum.tags.${thread.tag}`)}</span>
            {thread.official && <span className="badge tone-ok">{tr("forum.official")}</span>}
          </div>
          <h1 className="mt-3 h2 text-ink">{thread.title}</h1>
          <div className="mt-2"><Author name={thread.author_name} official={thread.official} date={thread.created_at} /></div>
          <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{thread.body}</p>
          <Actions type="thread" pid={thread.id} />
        </article>

        {/* Respuestas */}
        <h2 className="mt-8 px-1 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted">
          {replies.length === 0 ? tr("forum.noReplies") : replies.length === 1 ? tr("forum.replyOne") : tr("forum.replies", { n: replies.length })}
        </h2>
        <ul className="mt-3 grid gap-2.5">
          {replies.map((r: ReplyRow) => (
            <li key={r.id} className="card p-5">
              <Author name={r.author_name} official={r.official} date={r.created_at} />
              <p className="mt-2 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-ink">{r.body}</p>
              <Actions type="reply" pid={r.id} />
            </li>
          ))}
        </ul>

        {/* Responder */}
        <div id="final" className="mt-6 scroll-mt-20">
          {session ? (
            <form action="/api/forum" method="post" className="card grid gap-3 p-5">
              <input type="hidden" name="action" value="reply" />
              <input type="hidden" name="thread_id" value={thread.id} />
              <textarea name="body" required maxLength={5000} rows={4} placeholder={tr("forum.replyPlaceholder")} className="field py-3" />
              <div className="flex items-center justify-between gap-3">
                <p className="note">{tr("forum.rules")}</p>
                <button type="submit" className="btn btn-primary">{tr("forum.reply")}</button>
              </div>
            </form>
          ) : (
            <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-[14.5px] text-muted">{tr("forum.loginPrompt")}</p>
              <Link href={`/entrar?next=/comunidad/${thread.id}`} className="btn btn-secondary btn-sm">{tr("nav.login")}</Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
