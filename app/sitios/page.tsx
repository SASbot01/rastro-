import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { BROKERS } from "@/lib/brokers/catalog";
import { Pillars, ToolFaq, CtaBand, SectionLabel } from "@/components/landing/ToolSections";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro — ${tr("sites.title")}`, description: tr("sites.subtitle"), alternates: { canonical: "/sitios" } };
}

/** Indice publico (SEO): directorio por tipo de sitio, con pasos de baja. */
export default async function SitesPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const k = messages.toolkit.sites;
  const groups = new Map<string, typeof BROKERS>();
  for (const b of BROKERS) groups.set(b.kind, [...(groups.get(b.kind) ?? []), b]);

  const stats = [
    { value: String(BROKERS.length), label: k.statSitesLabel },
    { value: k.statFree, label: k.statFreeLabel },
    { value: k.statSteps, label: k.statStepsLabel },
  ];

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-10 sm:py-14">
        <p className="eyebrow">{tr("sites.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("sites.title")}</h1>
        <p className="lead mt-3 max-w-[62ch]">{k.intro}</p>

        {/* Stats de credibilidad */}
        <ul className="mt-7 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <li key={s.label} className="card p-4 text-center sm:p-5">
              <p className="num text-[26px] text-accent sm:text-[32px]">{s.value}</p>
              <p className="mt-1 text-[12px] leading-snug text-faint sm:text-[13px]">{s.label}</p>
            </li>
          ))}
        </ul>

        {/* Qué hace la guía */}
        <section className="mt-12">
          <SectionLabel>{tr("toolkit.common.howItWorks")}</SectionLabel>
          <div className="mt-4"><Pillars items={k.pillars} labels={[tr("toolkit.common.whatItDoes"), tr("toolkit.common.whyItMatters"), tr("toolkit.common.whatYouGet")]} /></div>
        </section>

        {/* Directorio */}
        <h2 className="mt-14 h2 text-ink">{k.directoryTitle}</h2>
        {[...groups.entries()].map(([kind, list]) => (
          <section key={kind} className="mt-7">
            <SectionLabel>{tr(`sites.kinds.${kind}`)}</SectionLabel>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {list.map((b) => (
                <li key={b.slug}>
                  <Link href={`/sitios/${b.slug}`} className="card card-link group flex h-full items-start gap-3 p-4 hover:!border-accent/50">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">{b.name}</span>
                      <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-muted">{b.shows}</span>
                      <span className="mt-2 block text-[12px] text-faint">{b.typicalDays === 0 ? tr("sites.typicalInstant") : b.typicalDays ? tr("sites.typical", { n: b.typicalDays }) : ""}</span>
                    </span>
                    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true"><path d="m7.5 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* FAQ + CTA */}
        <section className="mt-14"><ToolFaq title={tr("toolkit.common.faqTitle")} items={k.faq} /></section>
        <div className="mt-6"><CtaBand eyebrow={tr("sites.eyebrow")} title={tr("hero.title")} body={tr("sites.ctaBody")} cta={tr("sites.cta")} href="/#form" secondaryCta={tr("how.footerLink")} secondaryHref="/como-funciona" /></div>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
