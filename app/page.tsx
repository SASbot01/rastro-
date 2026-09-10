import { RequestForm } from "@/components/RequestForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d="m4.5 10.5 3.5 3.5 7.5-8"
        fill="none"
        stroke="#c8ff3d"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function HomePage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);

  const trust = [tr("hero.trust.own"), tr("hero.trust.verify"), tr("hero.trust.retention")];

  const steps = [
    { title: tr("how.step1Title"), body: tr("how.step1Body") },
    { title: tr("how.step2Title"), body: tr("how.step2Body") },
    { title: tr("how.step3Title"), body: tr("how.step3Body") },
  ];

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-12">
        <section className="pt-8 pb-8 sm:pt-14">
          <div className="mb-6 flex items-center gap-4 rounded-card border border-line bg-surface p-4">
            <div className="relative h-[72px] w-[72px] shrink-0">
              <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="36" cy="36" r="31" fill="none" stroke="#262626" strokeWidth="7" />
                <circle cx="36" cy="36" r="31" fill="none" stroke="#c8ff3d" strokeWidth="7" strokeLinecap="round" strokeDasharray="194.8" strokeDashoffset="68" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[22px] font-semibold tracking-[-0.03em] text-accent">65</span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">{tr("hero.demoTitle")}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{tr("hero.demoBody")}</p>
            </div>
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
            {tr("hero.eyebrow")}
          </p>
          <h1 className="mt-3 text-[34px] leading-[1.12] font-semibold tracking-[-0.025em] text-ink sm:text-[44px]">
            {tr("hero.title")}
          </h1>
          <p className="mt-4 text-[16px] leading-[1.65] text-muted sm:text-[17px]">
            {tr("hero.subtitle")}
          </p>

          <ul className="mt-6 grid gap-2.5">
            {trust.map((item) => (
              <li key={item} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section id="form" className="scroll-mt-6 pb-14 lg:pt-14">
          <RequestForm messages={messages} locale={locale} />
        </section>

        <section className="border-t border-line py-12 lg:col-span-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">
            {tr("how.title")}
          </h2>
          <ol className="mt-6 grid gap-7">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[13px] font-semibold text-accent"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
