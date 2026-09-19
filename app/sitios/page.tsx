import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { BROKERS } from "@/lib/brokers/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro — ${tr("sites.title")}`, description: tr("sites.subtitle"), alternates: { canonical: "/sitios" } };
}

/** Indice publico (SEO): un sitio por tarjeta, agrupado por tipo. */
export default async function SitesPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const groups = new Map<string, typeof BROKERS>();
  for (const b of BROKERS) groups.set(b.kind, [...(groups.get(b.kind) ?? []), b]);

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-10 sm:py-14">
        <p className="eyebrow">{tr("sites.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("sites.title")}</h1>
        <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-muted">{tr("sites.subtitle")}</p>

        {[...groups.entries()].map(([kind, list]) => (
          <section key={kind} className="mt-10">
            <h2 className="px-1 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted">{tr(`sites.kinds.${kind}`)}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {list.map((b) => (
                <li key={b.slug}>
                  <Link href={`/sitios/${b.slug}`} className="block h-full card p-4 hover:border-accent">
                    <p className="text-[15px] font-semibold text-ink">{b.name}</p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{b.shows}</p>
                    <p className="mt-2 text-[12px] text-faint">{b.typicalDays === 0 ? tr("sites.typicalInstant") : b.typicalDays ? tr("sites.typical", { n: b.typicalDays }) : ""}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-12 rounded-card border border-accent/40 bg-accent-soft p-6">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">{tr("hero.title")}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("sites.ctaBody")}</p>
          <Link href="/#form" className="mt-4 btn btn-primary">{tr("sites.cta")}</Link>
        </section>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
