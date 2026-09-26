import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { canGenerateDomainReport, recentDomainReports } from "@/lib/domain-report";
import { levelForDomain } from "@/lib/domain-report-core";

export const dynamic = "force-dynamic";
const LEVEL_TEXT = { green: "text-ok", orange: "text-warn", red: "text-danger" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `${tr("domainReport.generate.title")} — Rastro`, robots: { index: false, follow: false } };
}

/**
 * Generador del informe de dominio (Rastro Equipos). Administradores y cuentas
 * con equipo escriben un dominio y reciben el informe; el resto ve el aviso y
 * puede pedirlo (queda como interes comercial, sin mas datos que el correo).
 */
export default async function DomainReportGeneratorPage({ searchParams }: PageProps<"/equipos/informe">) {
  const { e, pedido } = await searchParams;
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const privileged = canGenerateDomainReport(user, session?.email);
  const recent = privileged ? await recentDomainReports(20) : [];
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const error = typeof e === "string" && ["invalid", "limit", "failed", "forbidden"].includes(e) ? e : null;

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-10 sm:py-14">
        <p className="eyebrow">{tr("domainReport.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("domainReport.generate.title")}</h1>
        <p className="mt-3 max-w-[60ch] text-[15.5px] leading-relaxed text-muted">{tr("domainReport.generate.body")}</p>
        {error && <p role="alert" className="mt-4 text-[13.5px] font-medium text-danger">{tr(`domainReport.generate.errors.${error}`)}</p>}

        {privileged ? (
          <>
            <form action="/api/domain-report/generate" method="post" className="mt-6 card grid gap-3 p-5 sm:p-6">
              <label className="grid gap-1.5 text-[13.5px] font-medium text-muted">
                {tr("domainReport.generate.label")}
                <input name="domain" required minLength={4} maxLength={253} autoComplete="off" spellCheck={false} inputMode="url" placeholder={tr("domainReport.generate.placeholder")} className="field" />
              </label>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="btn btn-primary">{tr("domainReport.generate.button")}</button>
              <p className="text-[12.5px] text-faint">{tr("domainReport.generate.hint")}</p>
            </form>
            {recent.length > 0 && (
              <section className="mt-8">
                <h2 className="px-1 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted">{tr("domainReport.generate.recent")}</h2>
                <ul className="mt-3 card divide-y divide-line">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <Link href={`/equipos/informe/${r.domain}`} className="flex items-center gap-3 px-5 py-3.5 text-[14.5px] hover:bg-white/[0.03]">
                        <span className={"num w-[42px] shrink-0 text-[18px] " + LEVEL_TEXT[levelForDomain(r.score)]}>{r.score}</span>
                        <span className="min-w-0 flex-1 truncate font-medium text-ink">{r.domain}</span>
                        <span className="shrink-0 text-[12.5px] text-faint">{r.locale.toUpperCase()} · {fmt.format(new Date(r.created_at))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <>
            <p className="mt-4 text-[14.5px] text-muted">{tr("domainReport.generate.forbidden")}</p>
            {pedido ? (
              <p role="status" className="mt-6 card card-accent p-5 text-[15px] font-medium text-ink">{tr("domainReport.request.sent")}</p>
            ) : (
              <form action="/api/domain-report" method="post" className="mt-6 card grid max-w-[480px] gap-3 p-5 sm:p-6">
                <label className="grid gap-1.5 text-[13.5px] font-medium text-muted">
                  {tr("domainReport.generate.label")}
                  <input name="domain" required minLength={4} maxLength={253} autoComplete="off" spellCheck={false} inputMode="url" placeholder={tr("domainReport.generate.placeholder")} className="field" />
                </label>
                <label className="grid gap-1.5 text-[13.5px] font-medium text-muted">
                  {tr("domainReport.request.email")}
                  <input type="email" name="email" required autoComplete="email" className="field" />
                </label>
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className="btn btn-primary">{tr("domainReport.request.button")}</button>
                <p className="text-[12.5px] text-faint">{tr("domainReport.request.legal")}</p>
              </form>
            )}
          </>
        )}
        <Link href="/equipos" className="mt-8 inline-block link text-[14px]">← Rastro Equipos</Link>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
