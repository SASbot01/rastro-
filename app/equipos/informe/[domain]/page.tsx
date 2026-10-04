import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CopyButton } from "@/components/CopyButton";
import { ScoreRing } from "@/components/experience/ScoreRing";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { absoluteUrl } from "@/lib/env";
import { teamPrices } from "@/lib/plan";
import { allowByKey } from "@/lib/rate-limit";
import { track } from "@/lib/events";
import { cachedDomainReport, canGenerateDomainReport, generateDomainReport, recommendationTexts, type DomainReportRow } from "@/lib/domain-report";
import { isValidDomain, linkedinSummary, type DomainReport } from "@/lib/domain-report-core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CARD = "card p-5 sm:p-6";
const SECTION_LABEL = "px-1 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted";
const LEVEL_TEXT = { green: "text-ok", orange: "text-warn", red: "text-danger" } as const;

type Tone = "ok" | "warn" | "bad" | "info";
interface Line { tone: Tone; text: string }
const DOT: Record<Tone, string> = { ok: "bg-ok", warn: "bg-warn", bad: "bg-danger", info: "bg-faint" };

function domainParam(raw: string): string | null {
  let value: string;
  try { value = decodeURIComponent(raw).toLowerCase(); } catch { return null; }
  return /^[a-z0-9.-]{4,253}$/.test(value) && isValidDomain(value) ? value : null;
}

export async function generateMetadata({ params }: PageProps<"/equipos/informe/[domain]">): Promise<Metadata> {
  const { domain: raw } = await params;
  const domain = domainParam(raw);
  if (!domain) return { robots: { index: false, follow: false } };
  const tr = translator(getMessages(await getLocale()));
  return { title: `${tr("domainReport.title", { domain })} — Rastro`, description: tr("domainReport.subtitle"), robots: { index: false, follow: false } };
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function Section({ title, lines, why, children }: { title: string; lines: Line[]; why?: string; children?: ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
      <ul className="mt-3 grid gap-2">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink"><span aria-hidden="true" className={"mt-[9px] h-2 w-2 shrink-0 rounded-full " + DOT[l.tone]} />{l.text}</li>
        ))}
      </ul>
      {children}
      {why && <p className="mt-4 border-t border-line pt-3 text-[13.5px] leading-relaxed text-muted">{why}</p>}
    </section>
  );
}

/** Informe publico de un dominio de empresa: nota, cinco secciones en lenguaje llano, tres acciones y CTA a Equipos. */
export default async function DomainReportPage({ params, searchParams }: PageProps<"/equipos/informe/[domain]">) {
  const { domain: raw } = await params;
  const { pedido } = await searchParams;
  const domain = domainParam(raw);
  if (!domain) notFound();
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const privileged = canGenerateDomainReport(user, session?.email);

  // Cache de 7 dias en el idioma del visitante; si no, en el otro idioma; si no, se genera (solo admin o cuenta con equipo).
  let row: DomainReportRow | null = (await cachedDomainReport(domain, locale)) ?? (await cachedDomainReport(domain, locale === "es" ? "en" : "es"));
  let generated = false;
  if (!row && privileged && (await allowByKey(user?.id ?? session?.email ?? domain, "domain_report"))) {
    row = await generateDomainReport(domain, locale, user?.id ?? null);
    generated = true;
  }

  if (!row) {
    return (
      <>
        <SiteHeader locale={locale} messages={messages} />
        <main className="page py-10 sm:py-14">
          <p className="eyebrow">{tr("domainReport.eyebrow")}</p>
          <h1 className="mt-2 h1 text-ink">{tr("domainReport.request.title", { domain })}</h1>
          <p className="mt-3 max-w-[60ch] text-[15.5px] leading-relaxed text-muted">{tr("domainReport.request.body")}</p>
          {pedido ? (
            <p role="status" className="mt-6 card card-accent p-5 text-[15px] font-medium text-ink">{tr("domainReport.request.sent")}</p>
          ) : (
            <form action="/api/domain-report" method="post" className="mt-6 grid max-w-[440px] gap-3">
              <input type="hidden" name="domain" value={domain} />
              <input type="hidden" name="locale" value={locale} />
              <label className="grid gap-1.5 text-[13.5px] font-medium text-muted">
                {tr("domainReport.request.email")}
                <input type="email" name="email" required autoComplete="email" className="field" />
              </label>
              <button type="submit" className="btn btn-primary">{tr("domainReport.request.button")}</button>
              <p className="text-[12.5px] text-faint">{tr("domainReport.request.legal")}</p>
            </form>
          )}
          <Link href="/equipos" className="mt-8 inline-block link text-[14px]">← Rastro Equipos</Link>
        </main>
        <SiteFooter messages={messages} />
      </>
    );
  }

  const r = row.report;
  const props = { score: r.score, locale };
  after(() => track(generated ? "domain_report_generated" : "domain_report_viewed", { subject: user?.id ?? null, locale, props }));

  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const recs = recommendationTexts(r, tr);
  const reportUrl = absoluteUrl(`/equipos/informe/${domain}`).toString();
  const copyText = linkedinSummary({ domain, score: r.score, recommendations: recs, url: reportUrl, lines: { title: tr("domainReport.copy.title"), actions: tr("domainReport.copy.actions"), footer: tr("domainReport.copy.footer") } });
  const price = teamPrices().small;

  // --- Correo ---
  const spfTone: Record<DomainReport["email"]["spf"], Tone> = { hard: "ok", soft: "warn", neutral: "warn", open: "warn", missing: "bad" };
  const dmarcTone: Record<DomainReport["email"]["dmarc"], Tone> = { reject: "ok", quarantine: "ok", none: "warn", missing: "bad" };
  const emailLines: Line[] = [
    { tone: dmarcTone[r.email.dmarc], text: tr(`domainReport.email.dmarc.${r.email.dmarc}`, { domain }) },
    { tone: spfTone[r.email.spf], text: tr(`domainReport.email.spf.${r.email.spf}`, { domain }) },
    r.email.dkimSelectors.length ? { tone: "ok", text: tr("domainReport.email.dkim.found", { list: r.email.dkimSelectors.join(", ") }) } : { tone: "warn", text: tr("domainReport.email.dkim.missing") },
    { tone: "info", text: tr("domainReport.email.provider", { provider: tr(`domainReport.email.providers.${r.email.mxProvider}`) }) },
  ];

  // --- Web ---
  const w = r.web;
  const webLines: Line[] = [];
  if (!w.reachable) webLines.push({ tone: "bad", text: tr("domainReport.web.unreachable") });
  else {
    if (w.status && w.status >= 400) webLines.push({ tone: "info", text: tr("domainReport.web.blocked", { status: w.status }) });
    webLines.push(w.https ? { tone: "ok", text: tr("domainReport.web.https.ok") } : { tone: "bad", text: tr("domainReport.web.https.missing") });
    webLines.push(w.httpRedirects === true ? { tone: "ok", text: tr("domainReport.web.redirect.ok") } : w.httpRedirects === false ? { tone: "warn", text: tr("domainReport.web.redirect.missing") } : { tone: "info", text: tr("domainReport.web.redirect.unknown") });
    if (w.https) webLines.push(w.hsts ? { tone: "ok", text: tr("domainReport.web.hsts.ok") } : { tone: "warn", text: tr("domainReport.web.hsts.missing") });
    webLines.push(w.csp ? { tone: "ok", text: tr("domainReport.web.csp.ok") } : { tone: "info", text: tr("domainReport.web.csp.missing") });
    webLines.push(w.xFrame ? { tone: "ok", text: tr("domainReport.web.frame.ok") } : { tone: "info", text: tr("domainReport.web.frame.missing") });
    webLines.push(w.versionLeak ? { tone: "bad", text: tr("domainReport.web.leak", { server: [w.serverHeader, w.poweredBy].filter(Boolean).join(", ") }) } : { tone: "ok", text: tr("domainReport.web.noLeak") });
    if (w.cms) webLines.push(w.cmsVersion ? { tone: "warn", text: tr("domainReport.web.cmsVersion", { cms: w.cms, version: w.cmsVersion }) } : { tone: "info", text: tr("domainReport.web.cms", { cms: w.cms }) });
    webLines.push(w.trackers.length ? { tone: w.trackers.length >= 5 ? "warn" : "info", text: tr(w.trackers.length === 1 ? "domainReport.web.trackers.one" : "domainReport.web.trackers.some", { n: w.trackers.length, list: w.trackers.map((x) => x.company).join(", ") }) } : { tone: "ok", text: tr("domainReport.web.trackers.none") });
    if (w.cookieBanner) webLines.push({ tone: "info", text: w.cookieBanner === "generic" ? tr("domainReport.web.banner.generic") : tr("domainReport.web.banner.found", { name: w.cookieBanner }) });
    else webLines.push(w.trackers.length ? { tone: "warn", text: tr("domainReport.web.banner.missing") } : { tone: "info", text: tr("domainReport.web.banner.missingNoTrackers") });
  }

  // --- Dominios parecidos ---
  const taken = r.lookalikes.filter((l) => l.registered);
  const free = r.lookalikes.filter((l) => !l.registered);
  const lookLines: Line[] = taken.length
    ? [{ tone: "info", text: tr("domainReport.lookalikes.some", { n: taken.length, total: r.lookalikes.length }) }, ...taken.map((l): Line => (l.likelyYours ? { tone: "ok", text: tr("domainReport.lookalikes.yours", { domain: l.domain }) } : { tone: "bad", text: tr("domainReport.lookalikes.registered", { domain: l.domain }) }))]
    : [{ tone: "ok", text: tr("domainReport.lookalikes.none", { n: r.lookalikes.length }) }];

  // --- Correos publicos (tapados) ---
  const e = r.emails;
  const emailsLines: Line[] = !e.checked
    ? [{ tone: "info", text: tr("domainReport.emails.unchecked") }]
    : e.total === 0
      ? [{ tone: "ok", text: tr("domainReport.emails.none", { domain }) }]
      : [{ tone: e.personal >= 3 ? "bad" : "warn", text: tr("domainReport.emails.some", { n: e.total, domain, personal: e.personal, generic: e.generic }) }];

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-8 sm:py-12">
        <p className="eyebrow">{tr("domainReport.eyebrow")}</p>
        <h1 className="mt-2 h1 break-words text-ink">{tr("domainReport.title", { domain })}</h1>
        <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-muted">{tr("domainReport.subtitle")}</p>
        <p className="mt-2 text-[13px] text-faint">{tr("domainReport.generated", { date: fmt.format(new Date(row.created_at)) })}</p>

        <section className={"mt-6 card card-glow flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:items-center sm:gap-8 sm:p-8 sm:text-left"}>
          <ScoreRing score={r.score} label={tr("domainReport.scoreLabel")} size={176} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted">{tr("domainReport.scoreLabel")}</p>
            <p className={"mt-1 text-[24px] font-semibold leading-tight tracking-[-0.02em] " + LEVEL_TEXT[r.level]}>{tr(`domainReport.level.${r.level}`)}</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{tr(`domainReport.levelBody.${r.level}`)}</p>
            {privileged && <div className="mt-4"><CopyButton text={copyText} label={tr("domainReport.copy.button")} doneLabel={tr("domainReport.copy.done")} /></div>}
          </div>
        </section>

        <h2 className={"mt-8 " + SECTION_LABEL}>{tr("domainReport.recTitle")}</h2>
        <ol className="mt-3 grid gap-2">
          {recs.map((text, i) => (
            <li key={i} className="card flex gap-4 p-4 sm:p-5">
              <span className="num shrink-0 text-[26px] text-accent" aria-hidden="true">{i + 1}</span>
              <p className="text-[15px] leading-relaxed text-ink">{text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-4">
          <Section title={tr("domainReport.sections.email")} lines={emailLines} why={tr("domainReport.email.why", { domain })} />
          <Section title={tr("domainReport.sections.web")} lines={webLines} why={tr("domainReport.web.why")} />
          <Section title={tr("domainReport.sections.lookalikes")} lines={lookLines} why={tr("domainReport.lookalikes.why")}>
            {free.length > 0 && <p className="mt-3 break-words text-[13px] leading-relaxed text-faint">{tr("domainReport.lookalikes.free", { list: free.map((l) => l.domain).join(", ") })}</p>}
          </Section>
          <Section title={tr("domainReport.sections.emails")} lines={emailsLines} why={tr("domainReport.emails.why")}>
            {e.masked.length > 0 && (
              <>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {e.masked.map((m) => <li key={m} className="rounded-full border border-line px-3 py-1 font-mono text-[12.5px] text-muted">{m}</li>)}
                </ul>
                <p className="mt-2 text-[12.5px] text-faint">{tr("domainReport.emails.masked")}</p>
              </>
            )}
          </Section>
          <section className={CARD}>
            <h2 className="text-[16px] font-semibold text-ink">{tr("domainReport.sections.ai")}</h2>
            <p className="mt-2 text-[13.5px] text-muted">{tr("domainReport.ai.intro", { domain })}</p>
            {r.ai ? (
              <>
                <blockquote className="mt-3 whitespace-pre-line rounded-2xl border border-line bg-paper/40 p-4 text-[14.5px] leading-relaxed text-ink">{r.ai.answer}</blockquote>
                {r.ai.sources.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-faint">
                    <span>{tr("domainReport.ai.sources")}:</span>
                    {r.ai.sources.map((s, i) => <a key={`${i}-${s.url}`} href={s.url} rel="noopener noreferrer nofollow" target="_blank" className="link-muted">[{i + 1}] {hostOf(s.url)}</a>)}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-[14.5px] text-muted">{tr("domainReport.ai.empty")}</p>
            )}
            <p className="mt-4 border-t border-line pt-3 text-[13.5px] leading-relaxed text-muted">{tr("domainReport.ai.why")}</p>
          </section>
        </div>

        <section className="mt-8 card card-accent p-6 sm:p-8">
          <p className="eyebrow">{tr("domainReport.eyebrow")}</p>
          <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">{tr("domainReport.cta.title")}</h2>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted">{tr("domainReport.cta.body", { price })}</p>
          <Link href="/equipos" className="mt-5 btn btn-primary">{tr("domainReport.cta.button")}</Link>
        </section>

        <section className="mt-4 card p-5 sm:p-6">
          <h2 className="text-[14px] font-semibold text-ink">{tr("domainReport.method.title")}</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{tr("domainReport.method.body")}</p>
        </section>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
