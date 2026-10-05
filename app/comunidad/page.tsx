import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { FORUM_TAGS } from "@/lib/forum-core";
import { listThreads } from "@/lib/forum";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `${tr("forum.title")} — Rastro`, description: tr("forum.lead"), alternates: { canonical: "/comunidad" } };
}

const CARD = "card p-5 sm:p-6";

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tag?: string; e?: string }> }) {
  const { tag, e } = await searchParams;
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const activeTag = typeof tag === "string" && (FORUM_TAGS as readonly string[]).includes(tag) ? tag : undefined;
  const threads = await listThreads({ tag: activeTag });
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-8 sm:py-12">
        <p className="eyebrow">{tr("forum.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("forum.title")}</h1>
        <p className="lead mt-3 max-w-[60ch] !text-[15.5px]">{tr("forum.lead")}</p>

        {e && (
          <p role="alert" className={"mt-4 rounded-[12px] px-4 py-3 text-[14px] " + (e === "reported" || e === "posted" ? "bg-accent-soft text-accent" : "bg-warn/10 text-warn")}>
            {tr(`forum.errors.${e}`)}
          </p>
        )}

        {/* Filtros por tema */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/comunidad" className={"chip " + (!activeTag ? "tone-ok" : "")}>{tr("forum.all")}</Link>
          {FORUM_TAGS.map((t) => (
            <Link key={t} href={`/comunidad?tag=${t}`} className={"chip " + (activeTag === t ? "tone-ok" : "")}>{tr(`forum.tags.${t}`)}</Link>
          ))}
        </div>

        {/* Nuevo tema */}
        <div className="mt-5">
          {session ? (
            <details className="card group p-0">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {tr("forum.new")}
                <span className="btn btn-primary btn-sm pointer-events-none">+</span>
              </summary>
              <form action="/api/forum" method="post" className="grid gap-3 border-t border-line px-5 py-5">
                <input type="hidden" name="action" value="thread" />
                <input name="title" required minLength={3} maxLength={140} placeholder={tr("forum.titlePlaceholder")} className="field !min-h-[48px]" />
                <textarea name="body" required maxLength={5000} rows={5} placeholder={tr("forum.bodyPlaceholder")} className="field py-3" />
                <div className="flex flex-wrap items-center gap-3">
                  <select name="tag" className="field !min-h-[48px] !w-auto" defaultValue={activeTag ?? "general"}>
                    {FORUM_TAGS.map((t) => <option key={t} value={t}>{tr(`forum.tags.${t}`)}</option>)}
                  </select>
                  <button type="submit" className="btn btn-primary">{tr("forum.publish")}</button>
                </div>
                <p className="note">{tr("forum.rules")}</p>
              </form>
            </details>
          ) : (
            <div className={CARD + " flex flex-wrap items-center justify-between gap-3"}>
              <p className="text-[14.5px] text-muted">{tr("forum.loginPrompt")}</p>
              <Link href="/entrar?next=/comunidad" className="btn btn-secondary btn-sm">{tr("nav.login")}</Link>
            </div>
          )}
        </div>

        {/* Hilos */}
        <ul className="mt-6 grid gap-2.5">
          {threads.length === 0 && <li className="text-[15px] text-muted">{tr("forum.empty")}</li>}
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/comunidad/${t.id}`} className="card card-link flex items-start gap-4 p-5 hover:!border-accent/50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {t.pinned && <span className="badge tone-ok uppercase">★</span>}
                    <span className="badge">{tr(`forum.tags.${t.tag}`)}</span>
                    {t.official && <span className="badge tone-ok">{tr("forum.official")}</span>}
                  </div>
                  <h2 className="mt-2 text-[16px] font-semibold leading-snug text-ink">{t.title}</h2>
                  <p className="mt-1 line-clamp-1 text-[13.5px] text-faint">{t.body}</p>
                  <p className="mt-2 text-[12.5px] text-faint">{t.author_name ? tr("forum.by", { name: t.author_name }) : ""} · {fmt.format(new Date(t.last_activity_at))}</p>
                </div>
                <span className="shrink-0 text-center">
                  <span className="block num text-[20px] text-ink">{t.reply_count}</span>
                  <span className="block text-[11px] text-faint">{tr("forum.repliesShort")}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
