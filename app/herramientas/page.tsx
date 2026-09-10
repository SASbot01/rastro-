import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { isPro } from "@/lib/plan";

export const dynamic = "force-dynamic";

/**
 * Pestana "Herramientas": vigilancia, escaner de buzon, cartas y plazos.
 * Sin sesion muestra las tarjetas con "Entrar"; sin Pro, con "Ver el plan Pro".
 */
export default async function ToolsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const pro = isPro(user);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  let letters: Array<{ id: string; host: string; status: string; deadline_at: string | null }> = [];
  let scans = 0;
  if (user) {
    const supabase = supabaseAdmin();
    const [{ data: l }, { count }] = await Promise.all([
      supabase.from("letters").select("id, host, status, deadline_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("mailbox_scans").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    letters = l ?? [];
    scans = count ?? 0;
  }

  const cta = (href: string) => (!user ? "/entrar" : pro ? href : "/pro");
  const ctaLabel = !user ? tr("nav.login") : pro ? tr("tools.open") : tr("pro.lockedCta");

  const Card = ({ title, body, href, meta }: { title: string; body: string; href: string; meta?: string }) => (
    <li className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{body}</p>
      {meta && <p className="mt-2 text-[12.5px] text-faint">{meta}</p>}
      <Link href={cta(href)} className="mt-4 inline-block rounded-[12px] bg-accent px-4 py-2.5 text-[14px] font-semibold text-black hover:opacity-90">
        {ctaLabel}
      </Link>
    </li>
  );

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] px-5 py-8 sm:py-12">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{pro ? tr("pro.badge") : tr("tools.eyebrow")}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em] text-ink">{tr("tools.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("tools.subtitle")}</p>

        <ul className="mt-6 grid gap-3">
          <Card title={tr("monitor.title")} body={tr("monitor.body")} href="/cuenta" meta={user ? (user.monitoring ? tr("monitor.on") : tr("monitor.off")) : undefined} />
          <Card title={tr("mailbox.title")} body={tr("account.mailboxCardBody")} href="/cuenta/buzon" meta={user && scans > 0 ? tr("tools.scans", { n: scans }) : undefined} />
          <Card title={tr("letters.listTitle")} body={tr("tools.lettersBody")} href="/cuenta" meta={user && letters.length > 0 ? tr("tools.letters", { n: letters.length }) : undefined} />
        </ul>

        {letters.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("deadlines.title")}</h2>
            <ul className="mt-3 grid gap-2">
              {letters.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3 text-[14px]">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{l.host}</p>
                    <p className="text-[12.5px] text-faint">
                      {tr(`letters.status.${l.status}`)}
                      {l.deadline_at && ` · ${tr("letters.deadline", { date: fmt.format(new Date(l.deadline_at)) })}`}
                    </p>
                  </div>
                  <Link href={`/cartas/${l.id}`} className="shrink-0 text-[13px] font-medium text-accent underline underline-offset-4">
                    {tr("letters.open")}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
