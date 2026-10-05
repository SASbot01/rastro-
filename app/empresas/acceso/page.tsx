import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `${tr("teamAccess.title")} — Rastro`, description: tr("teamAccess.lead"), alternates: { canonical: "/empresas/acceso" } };
}

const FIELD = "field !min-h-[48px]";

export default async function TeamAccessPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const { ok, e } = await searchParams;
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-12 sm:py-16">
        <p className="eyebrow">{tr("team.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("teamAccess.title")}</h1>
        <p className="lead mt-3 max-w-[60ch]">{tr("teamAccess.lead")}</p>

        {ok === "1" ? (
          <div className="card card-glow card-accent mt-8 max-w-[620px] p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-black" aria-hidden="true"><svg viewBox="0 0 20 20" className="h-5 w-5"><path d="m5 10.5 3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <h2 className="h3 text-ink">{tr("teamAccess.thanksTitle")}</h2>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{tr("teamAccess.thanksBody")}</p>
            <Link href="/" className="btn btn-secondary btn-sm mt-5">{tr("nav.brand")}</Link>
          </div>
        ) : (
          <>
            {e && <p role="alert" className="mt-4 max-w-[620px] rounded-[12px] bg-warn/10 px-4 py-3 text-[14px] text-warn">{tr(`teamAccess.errors.${e}`)}</p>}
            <form action="/api/team-request" method="post" className="card mt-6 grid max-w-[620px] gap-3 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-[13px] font-medium text-muted">{tr("teamAccess.name")}<input name="name" required minLength={2} maxLength={120} className={FIELD} /></label>
                <label className="grid gap-1.5 text-[13px] font-medium text-muted">{tr("teamAccess.company")}<input name="company" required minLength={2} maxLength={120} className={FIELD} /></label>
                <label className="grid gap-1.5 text-[13px] font-medium text-muted">{tr("teamAccess.role")}<input name="role" maxLength={120} className={FIELD} /></label>
                <label className="grid gap-1.5 text-[13px] font-medium text-muted">{tr("teamAccess.phone")}<input name="phone" type="tel" maxLength={40} className={FIELD} /></label>
                <label className="grid gap-1.5 text-[13px] font-medium text-muted">{tr("teamAccess.email")}<input name="email" type="email" required maxLength={160} className={FIELD} /></label>
                <label className="grid gap-1.5 text-[13px] font-medium text-muted">{tr("teamAccess.seats")}
                  <select name="seats" className={FIELD} defaultValue="">
                    <option value="" disabled>—</option>
                    <option value="1-10">1-10</option>
                    <option value="11-25">11-25</option>
                    <option value="26-50">26-50</option>
                    <option value="50+">50+</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-1.5 text-[13px] font-medium text-muted">{tr("teamAccess.message")}<textarea name="message" maxLength={2000} rows={4} className="field py-3" /></label>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <p className="note max-w-[42ch]">{tr("teamAccess.privacy")}</p>
                <button type="submit" className="btn btn-primary">{tr("teamAccess.submit")}</button>
              </div>
            </form>
          </>
        )}

        <p className="mt-6 text-[13.5px]"><Link href="/entrar" className="link">{tr("teamAccess.userLogin")}</Link></p>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
