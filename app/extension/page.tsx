import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { MascotDemo } from "@/components/MascotDemo";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { Pillars, ToolFaq, TrustRow, SectionLabel, ExampleFrame, ToolIcon } from "@/components/landing/ToolSections";

import { track } from "@/lib/events";
export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro Guardián — ${tr("ext.title")}`, description: tr("ext.subtitle"), alternates: { canonical: "/extension" } };
}

/** Logo generico de Chrome (tres arcos), sin marca registrada en el codigo. */
function ChromeMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8h9.2M8.5 14 3.9 6.1M15.5 14l-4.6 8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Extension del navegador: que hace, robot jugable y como instalarla (tienda si hay URL; si no, manual). */
export default async function ExtensionPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const features = messages.ext.features as string[];
  const install = messages.ext.install as string[];
  const storeSteps = messages.ext.storeSteps as string[];
  void track("extension_page_viewed", { locale });
  const storeUrl = process.env.NEXT_PUBLIC_CHROME_STORE_URL || "";
  const edgeUrl = process.env.NEXT_PUBLIC_EDGE_STORE_URL || "";
  const CARD = "card p-5 sm:p-6";
  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-10 sm:py-14">
        <p className="eyebrow">{tr("ext.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("ext.title")}</h1>
        <p className="lead mt-3 max-w-[62ch]">{tr("ext.subtitle")}</p>
        <TrustRow items={messages.toolkit.ext.trust} className="mt-5" />

        <section className="mt-6 rounded-card border border-accent/40 bg-accent-soft p-5">
          <h2 className="text-[16px] font-semibold text-ink">{tr("ext.play")}</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("ext.playBody")}</p>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className={CARD}>
            <ul className="grid gap-2.5">
              {features.map((f) => (
                <li key={f} className="flex gap-3 text-[14.5px] leading-relaxed text-ink"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{f}</li>
              ))}
            </ul>
          </section>
          <section className={CARD}>
            <h2 className="text-[16px] font-semibold text-ink">{tr("ext.installTitle")}</h2>
            {storeUrl ? (
              <>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("ext.storeBody")}</p>
                <a href={storeUrl} target="_blank" rel="noopener" className="mt-4 btn btn-primary">
                  <ChromeMark />{tr("ext.storeButton")}
                </a>
                {edgeUrl && <a href={edgeUrl} target="_blank" rel="noopener" className="ml-3 text-[13.5px] font-medium text-accent underline-offset-2 hover:underline">{tr("ext.storeEdge")}</a>}
                <ol className="mt-4 grid gap-2">
                  {storeSteps.map((s, i) => (
                    <li key={s} className="flex gap-3 text-[14px] leading-relaxed text-muted"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-black">{i + 1}</span>{s}</li>
                  ))}
                </ol>
              </>
            ) : (
              <>
                <p className="mt-1 text-[14px] font-medium text-ink">{tr("ext.soonTitle")}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("ext.soonBody")}</p>
                <ol className="mt-3 grid gap-2">
                  {install.map((s, i) => (
                    <li key={s} className="flex gap-3 text-[14px] leading-relaxed text-muted"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-black">{i + 1}</span>{s}</li>
                  ))}
                </ol>
                <a href="/extension/rastro-guardian.zip" className="mt-4 btn btn-primary">{tr("ext.download")}</a>
              </>
            )}
            <p className="mt-3 text-[12.5px] leading-relaxed text-faint">{tr("ext.privacy")} <Link href="/extension/privacidad" className="text-accent underline-offset-2 hover:underline">{tr("ext.privacyLink")}</Link></p>
          </section>
        </div>

        {/* Qué hace / por qué / qué te llevas */}
        <section className="mt-14">
          <SectionLabel>{tr("toolkit.common.howItWorks")}</SectionLabel>
          <div className="mt-4"><Pillars items={messages.toolkit.ext.pillars} labels={[tr("toolkit.common.whatItDoes"), tr("toolkit.common.whyItMatters"), tr("toolkit.common.whatYouGet")]} /></div>
        </section>

        {/* Ejemplo: aviso del robot */}
        <section className="reveal mt-14">
          <h2 className="h2 text-ink">{messages.toolkit.ext.exampleTitle}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:items-start">
            <ExampleFrame label={tr("toolkit.common.example")} note={tr("toolkit.common.sample")}>
              <div className="card card-glow glow-bad p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-danger/12 text-danger" aria-hidden="true"><ToolIcon name="alert" /></span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-danger">{messages.toolkit.ext.exampleAlert}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{messages.toolkit.ext.exampleAlertBody}</p>
                  </div>
                </div>
                <span className="btn btn-primary btn-sm mt-4 w-fit">{messages.toolkit.ext.exampleOfficial}</span>
              </div>
            </ExampleFrame>
            <ExampleFrame label={tr("toolkit.common.example")}>
              <div className="card p-5">
                <div className="flex items-end justify-between gap-2">
                  <p className="text-[13px] text-faint">{messages.toolkit.ext.exampleScoreLabel}</p>
                  <span className="num text-[28px] text-warn">{messages.toolkit.ext.exampleScore}<span className="text-[13px] !font-medium !tracking-normal text-faint"> /100</span></span>
                </div>
                <div className="meter mt-2"><i className="!bg-warn" style={{ width: `${Number(messages.toolkit.ext.exampleScore)}%` }} /></div>
                <ul className="mt-4 grid gap-2 text-[13.5px] text-muted">
                  {(messages.ext.features as string[]).slice(1, 4).map((f) => <li key={f} className="flex gap-2.5"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{f}</li>)}
                </ul>
              </div>
            </ExampleFrame>
          </div>
        </section>

        <section className="mt-14"><ToolFaq title={tr("toolkit.common.faqTitle")} items={messages.toolkit.ext.faq} /></section>
      </main>
      <MascotDemo locale={locale} labels={messages.ext as unknown as Record<string, unknown>} />
      <SiteFooter messages={messages} />
    </>
  );
}
