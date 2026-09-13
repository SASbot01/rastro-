import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { BROKERS, brokerBySlug } from "@/lib/brokers/catalog";

export function generateStaticParams() {
  return BROKERS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: PageProps<"/sitios/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const b = brokerBySlug(slug);
  if (!b) return {};
  const tr = translator(getMessages(await getLocale()));
  const title = tr("sites.pageTitle", { name: b.name });
  return { title: `${title} — Rastro`, description: b.shows, alternates: { canonical: `/sitios/${b.slug}` }, openGraph: { title, description: b.shows } };
}

/** Pagina publica por sitio: que muestra, contacto, pasos. Es la landing SEO "como borrar mis datos de X". */
export default async function SitePage({ params }: PageProps<"/sitios/[slug]">) {
  const { slug } = await params;
  const b = brokerBySlug(slug);
  if (!b) notFound();
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const CARD = "rounded-card border border-line bg-surface p-5";

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-10 sm:py-14">
        <Link href="/sitios" className="text-[13px] font-medium text-accent underline underline-offset-4">← {tr("sites.all")}</Link>
        <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr(`sites.kinds.${b.kind}`)}</p>
        <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-ink sm:text-[38px]">{tr("sites.pageTitle", { name: b.name })}</h1>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="grid gap-4">
            <section className={CARD}>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("sites.shows")}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink">{b.shows}</p>
            </section>
            <section className={CARD}>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("sites.how")}</h2>
              <ol className="mt-3 grid gap-3">
                {b.steps.map((st, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-black">{i + 1}</span>
                    {st}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[13px] text-muted">{b.typicalDays === 0 ? tr("sites.typicalInstant") : b.typicalDays ? tr("sites.typical", { n: b.typicalDays }) : ""}</p>
            </section>
            {b.notes && (
              <section className={CARD}>
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("sites.notes")}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{b.notes}</p>
              </section>
            )}
          </div>

          <aside className="grid gap-4">
            <section className={CARD}>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("sites.contact")}</h2>
              {b.email ? (
                <a href={`mailto:${b.email}`} className="mt-2 block break-all text-[15px] font-semibold text-ink underline underline-offset-4">{b.email}</a>
              ) : (
                <p className="mt-2 text-[14px] text-muted">—</p>
              )}
              {b.optOutUrl && (
                <>
                  <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("sites.optOut")}</h3>
                  <a href={b.optOutUrl} target="_blank" rel="noreferrer nofollow" className="mt-1 block break-all text-[13.5px] text-accent underline underline-offset-4">{b.optOutUrl}</a>
                </>
              )}
              <p className="mt-4 text-[12px] leading-relaxed text-faint">{b.confidence === "verified" ? tr("sites.verified", { date: fmt.format(new Date(b.checked)) }) : tr("sites.likely")}</p>
            </section>
            <section className="rounded-card border border-accent/40 bg-accent-soft p-5">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{tr("sites.ctaTitle", { name: b.name })}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{tr("sites.ctaBody")}</p>
              <Link href="/#form" className="mt-4 inline-block rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90">{tr("sites.cta")}</Link>
            </section>
          </aside>
        </div>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
