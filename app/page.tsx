import type { CSSProperties } from "react";
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

const CARD = "card";
const H2 = "h2 text-ink";
const EYEBROW = "eyebrow";
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

function CheckIcon({ className = "text-accent" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={"h-3.5 w-3.5 shrink-0 " + className} aria-hidden="true">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Anillo pequeño de las maquetas (datos de ejemplo). El color lo pone `className` (text-warn…). */
function ScoreRing({ value, size = 96, stroke = 8, className = "" }: { value: number; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={"relative shrink-0 " + className} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90 overflow-visible" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ filter: "drop-shadow(0 0 4px currentColor)" }} />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-ink" style={{ fontSize: size * 0.34 }}>{value}</span>
    </div>
  );
}

/* Iconos de "Que revisamos", en el orden del array de mensajes: filtraciones, IA, perfiles, datos falsos. */
const CHECK_ICONS = [
  "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3zM12 8.5v4M12 15.5v.01",
  "M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9L12 3.5zM18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8.8-1.9z",
  "M10.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM4 19.5a6.5 6.5 0 0 1 9-6M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.2 19.2 21 21",
  "M12 4 3.5 19h17L12 4zM12 10v4.5M12 17v.01",
];

/* ---------- Maquetas de "asi se ve tu informe" ---------- */

function MockBreaches({ tr }: { tr: (k: string) => string }) {
  const rows = [
    { name: tr("landing.mock.breach1"), detail: tr("landing.mock.breach1Detail"), pwd: true },
    { name: tr("landing.mock.breach2"), detail: tr("landing.mock.breach2Detail"), pwd: false },
    { name: tr("landing.mock.breach3"), detail: tr("landing.mock.breach3Detail"), pwd: true },
  ];
  return (
    <div className={CARD + " p-5"}>
      <div className="flex items-center justify-between gap-3">
        <p className="h3 text-ink">{tr("landing.mock.breachesTitle")}</p>
        <span className="badge tone-bad">{tr("landing.mock.breachesTag")}</span>
      </div>
      <ul className="mt-4 grid gap-2">
        {rows.map((r) => (
          <li key={r.name} className="tile flex items-center justify-between gap-3 overflow-hidden px-3.5 py-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">{r.name}</p>
              <p className="truncate text-[13px] text-faint">{r.detail}</p>
            </div>
            <span className={"badge " + (r.pwd ? "tone-bad" : "tone-warn")}>{r.pwd ? tr("landing.mock.withPassword") : tr("landing.mock.noPassword")}</span>
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
    <div className={CARD + " p-5"}>
      <p className="h3 text-ink">{tr("landing.mock.aiTitle")}</p>
      <p className="tile mt-4 rounded-tl-[4px] px-4 py-3 text-[14px] italic leading-relaxed text-muted">{tr("landing.mock.aiQuote")}</p>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {signals.map((s) => (
          <li key={s.label} className="tile px-3.5 py-2.5">
            <p className="text-[12.5px] leading-snug text-faint">{s.label}</p>
            <p className={"mt-1 flex items-center gap-1.5 text-[14px] font-semibold " + (s.bad ? "text-warn" : "text-accent")}><span className="dot" aria-hidden="true" />{s.value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MockScore({ tr }: { tr: (k: string) => string }) {
  const actions = [tr("landing.mock.action1"), tr("landing.mock.action2"), tr("landing.mock.action3")];
  return (
    <div className={CARD + " card-glow glow-warn p-5"}>
      <div className="flex items-center gap-4">
        <ScoreRing value={58} size={92} stroke={8} className="text-warn" />
        <div className="min-w-0">
          <p className="h3 text-ink">{tr("landing.mock.scoreTitle")}</p>
          <p className="mt-0.5 text-[14px] font-medium text-warn">{tr("landing.mock.scoreLevel")}</p>
          <p className="mt-1 text-[13px] text-faint">{tr("landing.sampleName")}</p>
        </div>
      </div>
      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">{tr("landing.mock.actionsTitle")}</p>
      <ol className="mt-2.5 grid gap-2">
        {actions.map((a, i) => (
          <li key={a} className="flex gap-2.5 text-[14px] leading-snug text-ink">
            <span className="num mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] text-black">{i + 1}</span>
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
        <section id="form" className="page scroll-mt-20 pb-14">
          <div className="mx-auto max-w-[560px]">
            <h2 className="h2 mb-5 text-ink">{tr("account.newReport")}</h2>
            <RequestForm messages={messages} locale={locale} />
          </div>
        </section>
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

      <main className="page">
        {/* Hero */}
        <section className="grid gap-10 pt-9 pb-16 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:gap-12 lg:pb-20">
          <div>
            <p className="rise chip tone-ok !py-1.5 !font-semibold" style={stagger(0)}>
              <span className="dot dot-live" aria-hidden="true" />
              {tr("hero.eyebrow")}
            </p>
            <h1 className="display rise mt-5 text-ink" style={stagger(1)}>
              {tr("hero.titleLead")} <span className="text-glow block text-accent">{tr("hero.titleAccent")}</span>
            </h1>
            <p className="lead rise mt-5 max-w-[46ch]" style={stagger(2)}>{tr("hero.subtitle")}</p>
            <div className="rise mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center" style={stagger(3)}>
              <Link href="#form" className="btn btn-primary btn-lg">{tr("landing.ctaPrimary")}<ArrowIcon /></Link>
              <Link href="#como" className="btn btn-ghost">{tr("landing.ctaSecondary")}</Link>
            </div>
            <ul className="rise mt-6 flex flex-wrap gap-x-5 gap-y-2" style={stagger(4)}>
              {trust.map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5 text-[13.5px] text-muted">
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Muneco en el "escaner", con datos de ejemplo flotando */}
          <div className="hero-stage fade-in relative mx-auto w-full max-w-[340px]" style={stagger(3)}>
            <div className="hero-rings" aria-hidden="true" />
            <div className="relative mx-auto w-[74%] overflow-hidden rounded-[36px] border border-line-strong shadow-[0_30px_80px_-30px_rgb(77_252_95/0.45)]">
              <img src="/brand/mascot-560.webp" alt="Rastro" width={560} height={560} className="block w-full" fetchPriority="high" />
              <span className="scanline" aria-hidden="true" />
            </div>
            <div className="float absolute left-0 top-5 flex items-center gap-2.5 rounded-[18px] border border-line-strong bg-surface/90 py-2 pl-2 pr-3.5 shadow-[0_12px_30px_rgb(0_0_0/0.5)] backdrop-blur" style={stagger(0)}>
              <ScoreRing value={58} size={42} stroke={4.5} className="text-warn" />
              <div>
                <p className="text-[11.5px] leading-tight text-faint">{tr("landing.mock.scoreTitle")} · {tr("hero.sample")}</p>
                <p className="num mt-0.5 text-[14px] text-ink">58 / 100</p>
              </div>
            </div>
            <div className="float absolute right-0 top-[31%] rounded-[16px] border border-line-strong bg-surface/90 px-3 py-2 shadow-[0_12px_30px_rgb(0_0_0/0.5)] backdrop-blur" style={stagger(1)}>
              <p className="text-[11.5px] leading-tight text-faint">{tr("landing.mock.breachesTitle")}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-danger"><span className="dot" aria-hidden="true" />{tr("landing.mock.breachesTag")}</p>
            </div>
            <div className="float absolute bottom-12 left-1 rounded-[16px] border border-line-strong bg-surface/90 px-3 py-2 shadow-[0_12px_30px_rgb(0_0_0/0.5)] backdrop-blur" style={stagger(2)}>
              <p className="text-[11.5px] leading-tight text-faint">{tr("landing.mock.signalWork")}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-warn"><span className="dot" aria-hidden="true" />{tr("landing.mock.yes")}</p>
            </div>
            <AskBubble label={tr("landing.askBubble")} className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap" />
          </div>
        </section>

        {/* Asi se ve */}
        <section className="reveal pb-16 lg:pb-20">
          <p className={EYEBROW}>{tr("report.eyebrow")}</p>
          <h2 className={"mt-2.5 " + H2}>{tr("landing.showTitle")}</h2>
          <p className="lead mt-3 max-w-[52ch]">{tr("landing.showBody")}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
            <MockScore tr={tr} />
            <MockBreaches tr={tr} />
            <MockAi tr={tr} />
          </div>
          <Link href="#form" className="btn btn-secondary mt-5 w-full sm:w-auto">{tr("landing.ctaPrimary")}<ArrowIcon /></Link>
        </section>

        {/* Como funciona */}
        <section id="como" className="reveal scroll-mt-24 pb-16 lg:pb-20">
          <h2 className={H2}>{tr("how.title")}</h2>
          <ol className="mt-7 grid gap-3 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className={CARD + " relative flex gap-4 p-5 sm:block"}>
                <span aria-hidden="true" className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-[16px] text-black shadow-[0_0_24px_-4px_rgb(77_252_95/0.7)]">{index + 1}</span>
                <div className="min-w-0 sm:mt-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">{tr("landing.stepLabel", { n: index + 1 })}</p>
                  <h3 className="h3 mt-1 text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Que revisamos */}
        <section className="reveal pb-16 lg:pb-20">
          <h2 className={H2}>{tr("landing.checkTitle")}</h2>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {landing.check.map((c, i) => (
              <li key={c.t} className={CARD + " flex gap-4 p-5"}>
                <span className="icon-tile" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]"><path d={CHECK_ICONS[i % CHECK_ICONS.length]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <div className="min-w-0">
                  <h3 className="h3 text-ink">{c.t}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{c.b}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Quienes somos / que hacemos */}
        <section className="reveal pb-16 lg:pb-20">
          <div className={CARD + " grid gap-6 p-6 sm:p-8 lg:grid-cols-[112px_minmax(0,1fr)]"}>
            <img src="/brand/mascot-112.png" alt="" width={112} height={112} loading="lazy" className="h-[88px] w-[88px] rounded-[24px] border border-line-strong lg:h-[112px] lg:w-[112px]" />
            <div>
              <p className={EYEBROW}>{tr("landing.whoTitle")}</p>
              <p className="mt-3 text-[16px] leading-[1.65] text-ink sm:text-[17px]">{tr("landing.whoBody")}</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="tile p-5">
                  <h3 className="h3 text-ink">{tr("landing.doTitle")}</h3>
                  <ul className="mt-3 grid gap-2.5">
                    {landing.do.map((x) => (
                      <li key={x} className="flex gap-2.5 text-[14.5px] leading-relaxed text-muted"><CheckIcon className="mt-1.5 text-accent" />{x}</li>
                    ))}
                  </ul>
                </div>
                <div className="tile p-5">
                  <h3 className="h3 text-ink">{tr("landing.dontTitle")}</h3>
                  <ul className="mt-3 grid gap-2.5">
                    {landing.dont.map((x) => (
                      <li key={x} className="flex gap-2.5 text-[14.5px] leading-relaxed text-muted">
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

        {/* Pro */}
        <section className="reveal pb-16 lg:pb-20">
          <div className="card card-glow card-accent p-6 sm:p-9">
            <h2 className={H2}>{tr("landing.proTitle")}</h2>
            <p className="lead mt-3 max-w-[60ch]">{tr("landing.proBody")}</p>
            <Link href="/pro" className="btn btn-primary mt-6">{tr("landing.proCta")}<ArrowIcon /></Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="reveal pb-16 lg:pb-20">
          <h2 className={H2}>{tr("landing.faqTitle")}</h2>
          <div className="mt-7 grid gap-2.5">
            {landing.faq.map((f) => (
              <details key={f.q} className={CARD + " acc group card-link px-5"}>
                <summary className="flex min-h-[60px] items-center justify-between gap-4 py-4 text-[16px] font-semibold leading-snug text-ink">
                  {f.q}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition-transform duration-300 group-open:rotate-180 group-open:text-accent" aria-hidden="true">
                    <svg viewBox="0 0 20 20" className="h-4 w-4"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </summary>
                <p className="acc-body pb-5 text-[15px] leading-[1.65] text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Formulario */}
        <section id="form" className="scroll-mt-24 pb-20">
          <div className="mb-6 text-center">
            <p className={EYEBROW}>{tr("hero.eyebrow")}</p>
            <h2 className={"mt-2.5 " + H2}>{tr("landing.formTitle")}</h2>
            <p className="lead mt-2">{tr("landing.formBody")}</p>
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
