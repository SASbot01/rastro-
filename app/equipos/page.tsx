import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { teamLinks, teamPrices } from "@/lib/plan";
import { canGenerateDomainReport } from "@/lib/domain-report";
import { Pillars, ToolFaq, TrustRow, SectionLabel } from "@/components/landing/ToolSections";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro Equipos — ${tr("team.title")}`, description: tr("team.subtitle"), alternates: { canonical: "/equipos" } };
}

/** v5 — Landing publica de Rastro Equipos (B2B). */
function Card({ name, p, per, cta }: { name: string; p: string; per: string; cta: string; contact: string; href: string | null }) {
  // Las empresas entran por solicitud de acceso (login especial), no por auto-checkout.
  return (
    <div className="flex flex-col card p-6">
      <h2 className="text-[15px] font-semibold text-ink">{name}</h2>
      <p className="mt-4 text-[40px] leading-none font-semibold tracking-[-0.03em] text-ink">{p}</p>
      <p className="mt-1 text-[13px] text-faint">{per}</p>
      <Link href="/empresas/acceso" className="mt-6 btn btn-primary">{cta}</Link>
    </div>
  );
}

export default async function TeamsLanding() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const links = teamLinks(user?.email ?? session?.email, user?.id);
  const price = teamPrices();
  const features = messages.team.features as string[];
  const canDomainReport = canGenerateDomainReport(user, session?.email);
  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-12 sm:py-16">
        <p className="eyebrow">{tr("team.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("team.title")}</h1>
        <p className="lead mt-3 max-w-[62ch]">{tr("team.subtitle")}</p>
        <TrustRow items={messages.toolkit.team.trust} className="mt-5" />

        {/* Prueba social: el riesgo humano en una cifra */}
        <ul className="mt-7 grid gap-3 sm:grid-cols-2">
          {[[messages.toolkit.team.stat1, messages.toolkit.team.stat1Label], [messages.toolkit.team.stat2, messages.toolkit.team.stat2Label]].map(([v, l]) => (
            <li key={l} className="card card-glow flex items-center gap-4 p-5">
              <span className="num shrink-0 text-[40px] text-accent">{v}</span>
              <span className="text-[14px] leading-relaxed text-muted">{l}</span>
            </li>
          ))}
        </ul>

        {user?.plan_kind === "team" ? (
          <Link href="/equipo" className="mt-6 btn btn-primary">{tr("team.dashTitle")} →</Link>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card name={tr("team.smallName")} p={price.small} per={tr("team.per", { n: price.smallSeats })} cta={tr("team.cta")} contact={tr("team.contact")} href={links.small} />
            <Card name={tr("team.largeName")} p={price.large} per={tr("team.per", { n: price.largeSeats })} cta={tr("team.cta")} contact={tr("team.contact")} href={links.large} />
          </div>
        )}
        {canDomainReport && (
          <Link href="/equipos/informe" className="mt-6 card card-link flex items-center gap-4 p-5">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{tr("domainReport.teamCard.title")}</span>
              <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">{tr("domainReport.teamCard.body")}</span>
            </span>
            <span className="shrink-0 text-[13.5px] font-semibold text-accent">{tr("domainReport.teamCard.cta")} →</span>
          </Link>
        )}
        {/* Tres ideas fuerza */}
        <section className="mt-12">
          <SectionLabel>{tr("toolkit.common.howItWorks")}</SectionLabel>
          <div className="mt-4"><Pillars items={messages.toolkit.team.pillars} labels={[tr("toolkit.common.whatItDoes"), tr("toolkit.common.whyItMatters"), tr("toolkit.common.whatYouGet")]} /></div>
        </section>

        {/* Todo lo que incluye */}
        <section className="mt-12">
          <SectionLabel>{tr("toolkit.common.whatYouGet")}</SectionLabel>
          <ul className="mt-4 grid gap-3">
            {features.map((f) => (
              <li key={f} className="card flex gap-3 p-4 text-[15px] leading-relaxed text-ink"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{f}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12"><ToolFaq title={tr("toolkit.common.faqTitle")} items={messages.toolkit.team.faq} /></section>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
