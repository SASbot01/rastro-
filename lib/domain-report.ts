import { Resolver } from "node:dns/promises";
import { supabaseAdmin } from "@/lib/supabase";
import { searchRaw } from "@/lib/brave";
import { askPerplexity } from "@/lib/perplexity";
import { getMessages, t, translator, type Locale } from "@/lib/i18n";
import { isPublicHttpUrl } from "@/lib/removal-stats";
import type { UserRow } from "@/lib/users";
import { TRACKER_DOMAINS } from "@/extensions/guardian/lib/trackers.js";
import {
  detectCms, detectCookieBanner, detectTrackers, evaluateHeaders, extractEmails, generateLookalikes, likelyOwned, mailProviderFor, parseDmarc, parseSpf,
  plainAnswer, recommendationsFor, scoreDomain, signalsFrom, summarizeEmails, thirdPartyHosts,
  type DomainAiAnswer, type DomainReport, type EmailChecks, type Lookalike, type PublicEmails, type Recommendation, type WebChecks,
} from "@/lib/domain-report-core";

/**
 * Informe de exposicion de un dominio de empresa (Rastro Equipos). Todas las
 * comprobaciones son publicas y desde fuera: DNS del correo (SPF, DMARC, DKIM,
 * MX), portada de la web (HTTPS, cabeceras, rastreadores, banner, CMS),
 * dominios parecidos (solo DNS, nunca se visitan), una busqueda en Brave por
 * "@dominio" (los correos se tapan antes de guardar nada) y una pregunta a
 * Perplexity. Coste por informe: 1 Brave + 1 Perplexity; el resto es gratis.
 * Se cachea 7 dias en domain_reports.
 */

export const DOMAIN_REPORT_CACHE_DAYS = 7;
const DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "dkim"];
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_BODY = 400_000;
const USER_AGENT = "Mozilla/5.0 (compatible; Rastro/1.0; +https://rastropro.com/equipos)";

const resolver = new Resolver({ timeout: 4000, tries: 2 });

async function txt(name: string): Promise<string[]> {
  try {
    return (await resolver.resolveTxt(name)).map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

async function nameservers(name: string): Promise<string[] | null> {
  try {
    return (await resolver.resolveNs(name)).map((h) => h.toLowerCase().replace(/\.$/, ""));
  } catch {
    try {
      const a = await resolver.resolve4(name);
      return a.length ? [] : null;
    } catch {
      return null;
    }
  }
}

// ---------- 1. Correo ----------

export async function checkEmail(domain: string): Promise<EmailChecks> {
  const [spfTxt, dmarcTxt, mx, ...dkim] = await Promise.all([
    txt(domain),
    txt(`_dmarc.${domain}`),
    resolver.resolveMx(domain).then((r) => r.sort((a, b) => a.priority - b.priority).map((x) => x.exchange.toLowerCase().replace(/\.$/, "")), () => [] as string[]),
    ...DKIM_SELECTORS.map((sel) => txt(`${sel}._domainkey.${domain}`)),
  ]);
  const spf = parseSpf(spfTxt);
  const dmarc = parseDmarc(dmarcTxt);
  const dkimSelectors = DKIM_SELECTORS.filter((_, i) => dkim[i].some((r) => /v=DKIM1|(^|;)\s*p=/i.test(r)));
  return { spf: spf.mode, spfRecord: spf.record, dmarc: dmarc.policy, dmarcRecord: dmarc.record, dkimSelectors, mxProvider: mailProviderFor(mx), mxHosts: mx.slice(0, 5) };
}

// ---------- 2. Web ----------

interface Fetched { response: Response; finalUrl: string; body: string }

/** GET siguiendo hasta 3 redirecciones, solo a hosts publicos, 10 s en total. */
async function fetchFollow(startUrl: string, withBody: boolean): Promise<Fetched | { error: string }> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isPublicHttpUrl(url)) return { error: "private_host" };
    let response: Response;
    try {
      response = await fetch(url, { method: "GET", redirect: "manual", signal, cache: "no-store", headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8", "accept-language": "es-ES,es;q=0.9,en;q=0.7" } });
    } catch (e) {
      return { error: String(e).slice(0, 160) };
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location && hop < MAX_REDIRECTS) {
      try {
        url = new URL(location, url).toString();
      } catch {
        return { error: "bad_redirect" };
      }
      await response.body?.cancel().catch(() => undefined);
      continue;
    }
    let body = "";
    if (withBody) {
      try {
        body = (await response.text()).slice(0, MAX_BODY);
      } catch {
        body = "";
      }
    } else await response.body?.cancel().catch(() => undefined);
    return { response, finalUrl: url, body };
  }
  return { error: "too_many_redirects" };
}

export async function checkWeb(domain: string): Promise<WebChecks> {
  const empty: WebChecks = {
    reachable: false, https: false, httpRedirects: null, finalUrl: null, status: null, hsts: false, csp: false, xFrame: false, xContentType: false,
    serverHeader: null, poweredBy: null, versionLeak: false, trackers: [], thirdPartyHosts: 0, cookieBanner: null, cms: null, cmsVersion: null,
  };
  // https en el dominio, luego en www.; si nada responde, http para saber si al menos existe la web.
  let page: Fetched | null = null;
  for (const url of [`https://${domain}/`, `https://www.${domain}/`]) {
    const r = await fetchFollow(url, true);
    if (!("error" in r)) { page = r; break; }
  }
  let https = Boolean(page);
  if (!page) {
    for (const url of [`http://${domain}/`, `http://www.${domain}/`]) {
      const r = await fetchFollow(url, true);
      if (!("error" in r)) { page = r; break; }
    }
    if (!page) return empty;
    https = page.finalUrl.startsWith("https://");
  }
  // ¿http:// redirige a https://? (solo la primera respuesta, sin seguirla)
  let httpRedirects: boolean | null = null;
  try {
    const r = await fetch(`http://${domain}/`, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(6000), cache: "no-store", headers: { "user-agent": USER_AGENT } });
    const loc = r.headers.get("location") ?? "";
    httpRedirects = r.status >= 300 && r.status < 400 ? loc.startsWith("https://") : false;
    await r.body?.cancel().catch(() => undefined);
  } catch {
    httpRedirects = null;
  }
  const headers = evaluateHeaders(page.response.headers);
  const hosts = thirdPartyHosts(page.body, domain);
  const cms = detectCms(page.body);
  return {
    ...empty, ...headers, reachable: true, https, httpRedirects, finalUrl: page.finalUrl, status: page.response.status,
    trackers: detectTrackers(hosts, TRACKER_DOMAINS), thirdPartyHosts: hosts.length, cookieBanner: detectCookieBanner(page.body), cms: cms.cms, cmsVersion: cms.version,
  };
}

// ---------- 3. Dominios parecidos ----------

export async function checkLookalikes(domain: string): Promise<Lookalike[]> {
  const candidates = generateLookalikes(domain);
  const a4 = (name: string) => resolver.resolve4(name).catch(() => [] as string[]);
  const [ownNs, ownA, ...rest] = await Promise.all([nameservers(domain), a4(domain), ...candidates.flatMap((c) => [nameservers(c.domain), a4(c.domain)])]);
  return candidates.map((c, i) => {
    const ns = rest[i * 2] as string[] | null;
    const a = rest[i * 2 + 1] as string[];
    const registered = ns !== null;
    return { ...c, registered, likelyYours: registered && likelyOwned({ domain, ownNs: ownNs ?? [], ownA, ns: ns ?? [], a }) };
  });
}

// ---------- 4. Correos publicos (tapados) ----------

export async function checkPublicEmails(domain: string, locale: Locale): Promise<PublicEmails> {
  const r = await searchRaw(`"@${domain}"`, locale, 20);
  if (!r.ok) return { total: 0, personal: 0, generic: 0, masked: [], checked: false };
  const text = r.hits.map((h) => `${h.title} ${h.snippet} ${decodeURIComponent(h.url)}`).join(" \n ");
  const addresses = extractEmails(text, domain).filter((a) => !/^(www\.|https?)/.test(a));
  return { ...summarizeEmails(addresses, 10), checked: true };
}

// ---------- 5. Lo que dice la IA ----------

export async function askAboutDomain(domain: string, locale: Locale): Promise<DomainAiAnswer | null> {
  const question = t(getMessages(locale), "domainReport.ai.question", { domain });
  const a = await askPerplexity(question, locale);
  if (!a || !a.answer) return null;
  return { question, answer: plainAnswer(a.answer), sources: a.sources.slice(0, 6) };
}

// ---------- Informe completo ----------

async function timed<T>(label: string, timings: Record<string, number>, run: () => Promise<T>, fallback: T): Promise<T> {
  const start = Date.now();
  try {
    return await run();
  } catch (e) {
    console.warn("[domain-report]", label, String(e).slice(0, 160));
    return fallback;
  } finally {
    timings[label] = Date.now() - start;
  }
}

export async function buildDomainReport(domain: string, locale: Locale): Promise<DomainReport> {
  const timings: Record<string, number> = {};
  const emptyEmail: EmailChecks = { spf: "missing", spfRecord: null, dmarc: "missing", dmarcRecord: null, dkimSelectors: [], mxProvider: "none", mxHosts: [] };
  const emptyWeb: WebChecks = {
    reachable: false, https: false, httpRedirects: null, finalUrl: null, status: null, hsts: false, csp: false, xFrame: false, xContentType: false,
    serverHeader: null, poweredBy: null, versionLeak: false, trackers: [], thirdPartyHosts: 0, cookieBanner: null, cms: null, cmsVersion: null,
  };
  const [email, web, lookalikes, emails, ai] = await Promise.all([
    timed("email", timings, () => checkEmail(domain), emptyEmail),
    timed("web", timings, () => checkWeb(domain), emptyWeb),
    timed("lookalikes", timings, () => checkLookalikes(domain), [] as Lookalike[]),
    timed("emails", timings, () => checkPublicEmails(domain, locale), { total: 0, personal: 0, generic: 0, masked: [], checked: false } as PublicEmails),
    timed("ai", timings, () => askAboutDomain(domain, locale), null),
  ]);
  const partial = { email, web, lookalikes, emails };
  const signals = signalsFrom(partial);
  const { score, level, breakdown } = scoreDomain(signals);
  return {
    domain, locale, score, level, breakdown, ...partial, ai,
    recommendations: recommendationsFor(signals, email.mxProvider),
    generatedAt: new Date().toISOString(),
    timings,
  };
}

const MAIL_RECS = new Set<Recommendation["key"]>(["dmarc_missing", "dmarc_none", "dmarc_quarantine", "spf_missing", "spf_soft", "dkim_missing"]);

/**
 * Texto de cada recomendacion en el idioma dado; la primera de correo lleva detras la pista del proveedor.
 * Se recalculan a partir de las senales guardadas (es determinista) para que las mejoras de texto y de reglas
 * lleguen tambien a los informes en cache.
 */
export function recommendationTexts(report: DomainReport, tr: ReturnType<typeof translator>): string[] {
  let hinted = false;
  return recommendationsFor(signalsFrom(report), report.email.mxProvider).map((r) => {
    const base = tr(`domainReport.recs.${r.key}`, { domain: report.domain, n: report.web.trackers.length });
    if (!MAIL_RECS.has(r.key) || hinted) return base;
    hinted = true;
    return `${base} ${tr(`domainReport.providerHint.${r.provider}`)}`;
  });
}

// ---------- Cache en BD ----------

export interface DomainReportRow { id: string; domain: string; locale: string; report: DomainReport; score: number; created_at: string }

export async function cachedDomainReport(domain: string, locale: Locale, maxAgeDays = DOMAIN_REPORT_CACHE_DAYS): Promise<DomainReportRow | null> {
  const since = new Date(Date.now() - maxAgeDays * 86_400_000).toISOString();
  const { data } = await supabaseAdmin()
    .from("domain_reports")
    .select("id, domain, locale, report, score, created_at")
    .eq("domain", domain)
    .eq("locale", locale)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<DomainReportRow>();
  return data ?? null;
}

export async function saveDomainReport(report: DomainReport, createdBy: string | null): Promise<DomainReportRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("domain_reports")
    .insert({ domain: report.domain, locale: report.locale, report, score: report.score, created_by: createdBy })
    .select("id, domain, locale, report, score, created_at")
    .single<DomainReportRow>();
  if (error) console.error("[domain-report] no se pudo guardar:", error.message);
  return data ?? null;
}

/** Genera y guarda. Devuelve la fila (o el informe sin guardar si la BD fallo). */
export async function generateDomainReport(domain: string, locale: Locale, createdBy: string | null): Promise<DomainReportRow> {
  const report = await buildDomainReport(domain, locale);
  const row = await saveDomainReport(report, createdBy);
  return row ?? { id: "", domain, locale, report, score: report.score, created_at: report.generatedAt };
}

export async function recentDomainReports(limit = 20): Promise<Array<Pick<DomainReportRow, "id" | "domain" | "locale" | "score" | "created_at">>> {
  const { data } = await supabaseAdmin()
    .from("domain_reports")
    .select("id, domain, locale, score, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Array<Pick<DomainReportRow, "id" | "domain" | "locale" | "score" | "created_at">>>();
  return data ?? [];
}

// ---------- Permisos ----------

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().includes(String(email).toLowerCase());
}

/** Puede generar informes: administradores y cuentas con organizacion (Rastro Equipos). */
export function canGenerateDomainReport(user: Pick<UserRow, "org_id"> | null, email: string | null | undefined): boolean {
  return isAdminEmail(email) || Boolean(user?.org_id);
}
