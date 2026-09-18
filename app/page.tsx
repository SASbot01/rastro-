import Link from "next/link";
import { cookies } from "next/headers";
import { Onboarding } from "@/components/experience/Onboarding";
import { AskBubble } from "@/components/AskBubble";
import { RequestForm } from "@/components/RequestForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator, type Messages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { Dashboard } from "@/components/Dashboard";

const CARD = "min-w-0 rounded-card border border-line bg-surface";
const H2 = "text-[24px] font-semibold tracking-[-0.025em] text-ink sm:text-[30px]";
const EYEBROW = "text-[12px] font-semibold uppercase tracking-[0.08em] text-accent";

function CheckIcon({ className = "text-accent" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={"h-3.5 w-3.5 shrink-0 " + className} aria-hidden="true">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScoreRing({ value, size = 96, stroke = 8, className = "" }: { value: number; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={"relative shrink-0 " + className} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#262626" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-semibold tracking-[-0.03em]" style={{ fontSize: size * 0.3 }}>{value}</span>
    </div>
  );
}

/* ---------- Maquetas de "asi se ve tu informe" ---------- */

function MockBreaches({ tr }: { tr: (k: string) => string }) {
  const rows = [
    { name: tr("landing.mock.breach1"), detail: tr("landing.mock.breach1Detail"), pwd: true },
    { name: tr("landing.mock.breach2"), detail: tr("landing.mock.breach2Detail"), pwd: false },
    { name: tr("landing.mock.breach3"), detail: tr("landing.mock.breach3Detail"), pwd: true },
  ];
  return (
    <div className={CARD + " p-4"}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold text-ink">{tr("landing.mock.breachesTitle")}</p>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-danger/15 px-2.5 py-0.5 text-[11px] font-semibold text-danger">{tr("landing.mock.breachesTag")}</span>
      </div>
      <ul className="mt-3 grid gap-2">
        {rows.map((r) => (
          <li key={r.name} className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-[12px] bg-surface-2 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{r.name}</p>
              <p className="truncate text-[12px] text-faint">{r.detail}</p>
            </div>
            <span className={"shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold " + (r.pwd ? "bg-danger/15 text-danger" : "bg-warn/15 text-warn")}>
              {r.pwd ? tr("landing.mock.withPassword") : tr("landing.mock.noPassword")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MockAi({ tr }: { tr: (k: string) => string }) {
  const signals = [
    { label: tr("landing.mock.signalWork"), value: tr("landing.mock.yes"), bad: true },
    { label: tr("landing.mock.signalCity"), value: tr("landing.mock.yes"), bad: true },
    { label: tr("landing.mock.signalPhone"), value: tr("landing.mock.no"), bad: false },
    { label: tr("landing.mock.signalFalse"), value: tr("landing.mock.found"), bad: true },
  ];
  return (
    <div className={CARD + " p-4"}>
      <p className="text-[14px] font-semibold text-ink">{tr("landing.mock.aiTitle")}</p>
      <p className="mt-2 rounded-[12px] border-l-2 border-accent bg-surface-2 px-3 py-2.5 text-[13px] italic leading-relaxed text-muted">{tr("landing.mock.aiQuote")}</p>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {signals.map((s) => (
          <li key={s.label} className="rounded-[12px] bg-surface-2 px-3 py-2">
            <p className="text-[11.5px] text-faint">{s.label}</p>
            <p className={"mt-0.5 text-[13px] font-semibold " + (s.bad ? "text-warn" : "text-accent")}>{s.value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MockScore({ tr }: { tr: (k: string) => string }) {
  const actions = [tr("landing.mock.action1"), tr("landing.mock.action2"), tr("landing.mock.action3")];
  return (
    <div className={CARD + " p-4"}>
      <div className="flex items-center gap-4">
        <ScoreRing value={58} size={84} stroke={7} className="text-warn" />
        <div>
          <p className="text-[14px] font-semibold text-ink">{tr("landing.mock.scoreTitle")}</p>
          <p className="text-[13px] text-warn">{tr("landing.mock.scoreLevel")}</p>
          <p className="mt-1 text-[12px] text-faint">{tr("landing.sampleName")}</p>
        </div>
      </div>
      <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("landing.mock.actionsTitle")}</p>
      <ol className="mt-2 grid gap-1.5">
        {actions.map((a, i) => (
          <li key={a} className="flex gap-2.5 text-[13px] leading-snug text-ink">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-black">{i + 1}</span>
            {a}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- Portada ---------- */

export default async function HomePage() {
  const locale = await getLocale();
  const messages: Messages = getMessages(locale);
  const tr = translator(messages);

  // Con sesion, Inicio es el panel personal: la portada comercial ya no aporta nada.
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  if (user) {
    return (
      <>
        <SiteHeader locale={locale} messages={messages} />
        <Dashboard locale={locale} messages={messages} user={user} />
        <section id="form" className="ex-page scroll-mt-20"><div className="mx-auto max-w-[560px]"><h2 className="mb-5 text-2xl font-semibold tracking-tight">{tr("account.newReport")}</h2><RequestForm messages={messages} locale={locale}/></div></section>
        <SiteFooter messages={messages} />
      </>
    );
  }

  const trust = [tr("hero.trust.own"), tr("hero.trust.verify"), tr("hero.trust.retention")];
  const steps = [
    { title: tr("how.step1Title"), body: tr("how.step1Body") },
    { title: tr("how.step2Title"), body: tr("how.step2Body") },
    { title: tr("how.step3Title"), body: tr("how.step3Body") },
  ];
  const landing = messages.landing as {
    do: string[];
    dont: string[];
    check: { t: string; b: string }[];
    faq: { q: string; a: string }[];
  };

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5">
        {/* Hero */}
        <section className="grid gap-8 pt-8 pb-12 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center lg:gap-12">
          <div>
            <p className={EYEBROW}>{tr("hero.eyebrow")}</p>
            <h1 className="mt-3 text-[36px] leading-[1.06] font-semibold tracking-[-0.03em] text-ink sm:text-[50px]">{tr("hero.title")}</h1>
            <p className="mt-4 max-w-[46ch] text-[16px] leading-[1.6] text-muted sm:text-[17px]">{tr("hero.subtitle")}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="#form" className="rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90">{tr("landing.ctaPrimary")}</Link>
              <Link href="#como" className="rounded-[12px] border border-line bg-surface px-5 py-3 text-[15px] font-semibold text-ink hover:border-faint">{tr("landing.ctaSecondary")}</Link>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2">
              {trust.map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink">
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Muneco */}
          <div className="relative mx-auto w-[240px] sm:w-[280px] lg:w-full">
            <div className="absolute inset-6 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
            <img src="/brand/mascot-560.webp" alt="Rastro" width={560} height={560} className="relative w-full rounded-[32px] border border-line" />
            <div className="absolute -left-3 top-4 flex items-center gap-2 rounded-card border border-line bg-surface/95 px-3 py-2 backdrop-blur sm:-left-6">
              <ScoreRing value={65} size={40} stroke={4} className="text-accent" />
              <div>
                <p className="text-[11px] text-faint">{tr("profile.score")}</p>
                <p className="text-[12.5px] font-semibold text-ink">65 / 100</p>
              </div>
            </div>
            <AskBubble label={tr("landing.askBubble")} className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap" />
          </div>
        </section>

        {/* Asi se ve */}
        <section className="pb-14">
          <p className={EYEBROW}>{tr("report.eyebrow")}</p>
          <h2 className={"mt-2 " + H2}>{tr("landing.showTitle")}</h2>
          <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-muted">{tr("landing.showBody")}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
            <MockBreaches tr={tr} />
            <MockAi tr={tr} />
            <MockScore tr={tr} />
          </div>
        </section>

        {/* Quienes somos / que hacemos */}
        <section className="pb-14">
          <div className={CARD + " grid gap-6 p-6 sm:p-8 lg:grid-cols-[112px_minmax(0,1fr)]"}>
            <img src="/brand/mascot-112.png" alt="" width={112} height={112} className="h-[88px] w-[88px] rounded-[22px] lg:h-[112px] lg:w-[112px]" />
            <div>
              <p className={EYEBROW}>{tr("landing.whoTitle")}</p>
              <p className="mt-2 text-[16px] leading-relaxed text-ink">{tr("landing.whoBody")}</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-ink">{tr("landing.doTitle")}</h3>
                  <ul className="mt-2 grid gap-2">
                    {landing.do.map((x) => (
                      <li key={x} className="flex gap-2 text-[14px] leading-relaxed text-muted"><CheckIcon className="mt-1.5 text-accent" />{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-ink">{tr("landing.dontTitle")}</h3>
                  <ul className="mt-2 grid gap-2">
                    {landing.dont.map((x) => (
                      <li key={x} className="flex gap-2 text-[14px] leading-relaxed text-muted">
                        <svg viewBox="0 0 20 20" className="mt-1.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como" className="scroll-mt-20 pb-14">
          <h2 className={H2}>{tr("how.title")}</h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className={CARD + " p-5"}>
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[14px] font-semibold text-black">{index + 1}</span>
                <h3 className="mt-3 text-[15px] leading-snug font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Que revisamos */}
        <section className="pb-14">
          <h2 className={H2}>{tr("landing.checkTitle")}</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {landing.check.map((c) => (
              <li key={c.t} className={CARD + " p-5"}>
                <h3 className="text-[15px] font-semibold text-ink">{c.t}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{c.b}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Pro */}
        <section className="pb-14">
          <div className="rounded-card border border-accent/40 bg-accent-soft p-6 sm:p-8">
            <h2 className={H2}>{tr("landing.proTitle")}</h2>
            <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted">{tr("landing.proBody")}</p>
            <Link href="/pro" className="mt-4 inline-block rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90">{tr("landing.proCta")}</Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-14">
          <h2 className={H2}>{tr("landing.faqTitle")}</h2>
          <div className="mt-6 grid gap-2">
            {landing.faq.map((f) => (
              <details key={f.q} className={CARD + " group px-5 py-4"}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" aria-hidden="true"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Formulario */}
        <section id="form" className="scroll-mt-20 pb-16">
          <div className="mb-5 text-center">
            <h2 className={H2}>{tr("landing.formTitle")}</h2>
            <p className="mt-1 text-[15px] text-muted">{tr("landing.formBody")}</p>
          </div>
          <div className="mx-auto max-w-[560px]">
            <Onboarding messages={messages} initialDone={(await cookies()).get("rastro_onboarded")?.value === "1"}><RequestForm messages={messages} locale={locale} /></Onboarding>
          </div>
        </section>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
