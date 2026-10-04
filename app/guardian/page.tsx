import type { CSSProperties } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { GuardianForm } from "@/components/GuardianForm";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import type { Metadata } from "next";
import { Pillars, ToolFaq, CtaBand, TrustRow, SectionLabel, ExampleFrame, ToolIcon } from "@/components/landing/ToolSections";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro — ${tr("guardian.title")}`, description: tr("guardian.subtitle") };
}

/** v3 — Guardián: ¿es una estafa? Landing que vende + formulario real. */
export default async function GuardianPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const k = messages.toolkit.guardian;
  const pillarLabels = [tr("toolkit.common.whatItDoes"), tr("toolkit.common.whyItMatters"), tr("toolkit.common.whatYouGet")];

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-8 sm:py-12">
        {/* Hero */}
        <p className="eyebrow">{tr("guardian.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("guardian.title")}</h1>
        <p className="lead mt-3 max-w-[60ch]">{tr("guardian.subtitle")}</p>
        <TrustRow items={k.trust} className="mt-5" />

        {/* Formulario real */}
        <div className="mt-6"><GuardianForm messages={messages} locale={locale} personalized={Boolean(session)} /></div>

        {/* Qué hace / por qué / qué te llevas */}
        <section className="mt-14">
          <SectionLabel>{tr("toolkit.common.howItWorks")}</SectionLabel>
          <div className="mt-4"><Pillars items={k.pillars} labels={pillarLabels} /></div>
        </section>

        {/* Ejemplo de veredicto */}
        <section className="reveal mt-14">
          <h2 className="h2 text-ink">{k.exampleTitle}</h2>
          <div className="mt-6 grid gap-3 lg:grid-cols-2 lg:items-start">
            <ExampleFrame label={tr("toolkit.common.example")} note={tr("toolkit.common.sample")}>
              <div className="card p-5">
                <p className="eyebrow !text-faint">{k.exampleMsgTitle}</p>
                <p className="mt-2 text-[12.5px] text-faint">{k.exampleSender}</p>
                <p className="mt-2 whitespace-pre-line rounded-[12px] bg-surface-2 p-4 text-[14px] leading-relaxed text-ink">{k.exampleBody}</p>
              </div>
            </ExampleFrame>
            <div className="card card-glow glow-bad p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-danger/15 px-3 py-1 text-[12.5px] font-semibold uppercase tracking-wide text-danger">{k.exampleVerdict}</span>
                <span className="text-[12.5px] text-faint">{k.exampleConfidence}</span>
              </div>
              <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-ink">{k.exampleHeadline}</h3>
              <ul className="mt-3 grid gap-1.5">
                {k.exampleReasons.map((r) => <li key={r} className="flex gap-2 text-[14px] leading-relaxed text-muted"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />{r}</li>)}
              </ul>
              <p className="mt-4 eyebrow">{tr("guardian.actions")}</p>
              <p className="mt-1 flex gap-2.5 text-[14px] leading-relaxed text-ink"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-black">1</span>{k.exampleAction}</p>
            </div>
          </div>
        </section>

        {/* Telegram + gratis/Pro */}
        <section className="mt-14 grid gap-3 sm:grid-cols-2">
          <div className="reveal card flex flex-col p-5 sm:p-6">
            <span className="icon-tile" aria-hidden="true"><ToolIcon name="shield" /></span>
            <h2 className="h3 mt-4 text-ink">{k.telegramTitle}</h2>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{k.telegramBody}</p>
            <p className="mt-3 font-mono text-[13.5px] text-accent">{k.telegramHandle}</p>
            <a href="https://t.me/RastroGuardianBot" target="_blank" rel="noreferrer noopener" className="btn btn-secondary btn-sm mt-4 w-fit">{k.telegramCta}</a>
          </div>
          <div className="reveal card card-glow p-5 sm:p-6" style={{ "--i": 1 } as CSSProperties}>
            <span className="icon-tile" aria-hidden="true"><ToolIcon name="check" /></span>
            <h2 className="h3 mt-4 text-ink">{k.freeTitle}</h2>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{k.freeBody}</p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-14"><ToolFaq title={tr("toolkit.common.faqTitle")} items={k.faq} /></section>

        {/* CTA */}
        <div className="mt-6"><CtaBand title={tr("landing.formTitle")} body={tr("landing.formBody")} cta={tr("landing.ctaPrimary")} href="/#form" secondaryCta={tr("how.footerLink")} secondaryHref="/como-funciona" /></div>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
