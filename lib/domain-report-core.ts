// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Informe de exposicion de un DOMINIO de empresa (Rastro Equipos). Aqui vive
 * todo lo determinista: validar el dominio, leer SPF/DMARC, generar dominios
 * parecidos, tapar correos, evaluar cabeceras, contar rastreadores y calcular
 * la nota. Las consultas de red (DNS, fetch, Brave, Perplexity) estan en
 * lib/domain-report.ts. Regla legal: nunca se guardan ni se muestran datos de
 * personas; los correos salen tapados y solo se conservan asi.
 */

export type DomainLevel = "green" | "orange" | "red";
export type SpfMode = "missing" | "hard" | "soft" | "neutral" | "open";
export type DmarcPolicy = "missing" | "none" | "quarantine" | "reject";
export type MailProvider = "google" | "microsoft" | "ovh" | "ionos" | "other" | "none";
export type TrackerCategory = "ads" | "analytics" | "social" | "broker" | "cdn";

export interface EmailChecks {
  spf: SpfMode;
  spfRecord: string | null;
  dmarc: DmarcPolicy;
  dmarcRecord: string | null;
  /** Selectores DKIM con clave publicada (vacio = no encontramos ninguno de los habituales). */
  dkimSelectors: string[];
  mxProvider: MailProvider;
  mxHosts: string[];
}

export interface WebChecks {
  /** false si no respondio ni por https ni por http. */
  reachable: boolean;
  https: boolean;
  /** http:// redirige a https:// (null si no se pudo comprobar). */
  httpRedirects: boolean | null;
  finalUrl: string | null;
  status: number | null;
  hsts: boolean;
  csp: boolean;
  xFrame: boolean;
  xContentType: boolean;
  serverHeader: string | null;
  poweredBy: string | null;
  versionLeak: boolean;
  trackers: TrackerCompany[];
  thirdPartyHosts: number;
  cookieBanner: string | null;
  cms: string | null;
  cmsVersion: string | null;
}

export interface TrackerCompany { company: string; category: TrackerCategory; hosts: string[] }

export interface Lookalike {
  domain: string;
  kind: "typo" | "suffix" | "tld";
  registered: boolean;
  /** Mismos servidores de nombres que el dominio original: casi seguro es de la propia empresa. */
  likelyYours: boolean;
}

export interface PublicEmails {
  total: number;
  personal: number;
  generic: number;
  masked: string[];
  /** false si Brave no respondio. */
  checked: boolean;
}

export interface DomainAiAnswer { question: string; answer: string; sources: Array<{ title: string; url: string }> }

export interface DomainScoreSignals {
  spf: SpfMode;
  dmarc: DmarcPolicy;
  dkim: boolean;
  reachable: boolean;
  https: boolean;
  hsts: boolean;
  csp: boolean;
  versionLeak: boolean;
  lookalikesRegistered: number;
  trackers: number;
  personalEmails: number;
}

export interface DomainReport {
  domain: string;
  locale: string;
  score: number;
  level: DomainLevel;
  breakdown: Record<string, number>;
  email: EmailChecks;
  web: WebChecks;
  lookalikes: Lookalike[];
  emails: PublicEmails;
  ai: DomainAiAnswer | null;
  recommendations: Recommendation[];
  generatedAt: string;
  /** Milisegundos por fuente, para depurar. */
  timings: Record<string, number>;
}

export interface Recommendation { key: RecommendationKey; provider: MailProvider }
export type RecommendationKey =
  | "dmarc_missing" | "dmarc_none" | "dmarc_quarantine" | "https_missing" | "unreachable" | "spf_missing" | "spf_soft"
  | "lookalikes" | "dkim_missing" | "hsts_missing" | "version_leak" | "public_emails" | "trackers" | "csp_missing" | "mfa" | "passwords" | "access_review";

// ---------- Dominio ----------

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?)+$/;

/** Acepta "https://www.Empresa.es/contacto" y devuelve "empresa.es"; null si no es un dominio. */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (value.startsWith("www.")) value = value.slice(4);
  return isValidDomain(value) ? value : null;
}

export function isValidDomain(value: string): boolean {
  if (value.length < 4 || value.length > 253) return false;
  if (!/^[a-z0-9.-]+$/.test(value) || value.startsWith("-") || value.startsWith(".")) return false;
  if (!value.includes(".")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) return false;
  return DOMAIN_RE.test(value);
}

/** Dominio registrable aproximado: "tienda.empresa.com" -> "empresa.com", "algo.empresa.co.uk" -> "empresa.co.uk". */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const secondLevel = new Set(["co", "com", "org", "net", "gov", "edu", "ac", "nom", "gob"]);
  const last = parts[parts.length - 1];
  const penult = parts[parts.length - 2];
  if (penult.length <= 3 && secondLevel.has(penult) && last.length === 2) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

// ---------- Correo: SPF, DMARC, MX ----------

export function parseSpf(records: string[]): { mode: SpfMode; record: string | null } {
  const record = records.map((r) => r.trim()).find((r) => /^v=spf1\b/i.test(r)) ?? null;
  if (!record) return { mode: "missing", record: null };
  const all = /(?:^|\s)([-~?+]?)all(?:\s|$)/i.exec(record);
  if (!all) return { mode: "open", record };
  const q = all[1];
  if (q === "-") return { mode: "hard", record };
  if (q === "~") return { mode: "soft", record };
  if (q === "?") return { mode: "neutral", record };
  return { mode: "open", record };
}

export function parseDmarc(records: string[]): { policy: DmarcPolicy; record: string | null } {
  const record = records.map((r) => r.trim()).find((r) => /^v=DMARC1\b/i.test(r)) ?? null;
  if (!record) return { policy: "missing", record: null };
  const p = /(?:^|;)\s*p\s*=\s*(none|quarantine|reject)/i.exec(record);
  const policy = (p?.[1]?.toLowerCase() as DmarcPolicy | undefined) ?? "none";
  return { policy, record };
}

export function mailProviderFor(mxHosts: string[]): MailProvider {
  if (mxHosts.length === 0) return "none";
  const joined = mxHosts.map((h) => h.toLowerCase()).join(" ");
  if (/google\.com|googlemail\.com/.test(joined)) return "google";
  if (/outlook\.com|protection\.outlook|microsoft\.com/.test(joined)) return "microsoft";
  if (/\bovh\.net|\bovh\.com|mail\.ovh/.test(joined)) return "ovh";
  if (/ionos\.|1and1\.|kundenserver\.|1und1\./.test(joined)) return "ionos";
  return "other";
}

// ---------- Dominios parecidos ----------

const KEYBOARD_NEIGHBORS: Record<string, string> = { a: "s", e: "r", i: "o", o: "p", u: "i", s: "a", n: "m", m: "n", l: "k", r: "t", t: "y", c: "v", d: "s", g: "h" };

/** ~12 dominios que un estafador registraria para hacerse pasar por la empresa. */
export function generateLookalikes(domain: string): Array<{ domain: string; kind: Lookalike["kind"] }> {
  const dot = domain.indexOf(".");
  const name = domain.slice(0, dot);
  const tld = domain.slice(dot + 1);
  const out: Array<{ domain: string; kind: Lookalike["kind"] }> = [];
  const seen = new Set<string>([domain]);
  const push = (candidate: string, kind: Lookalike["kind"]) => {
    if (seen.has(candidate) || !isValidDomain(candidate)) return;
    seen.add(candidate);
    out.push({ domain: candidate, kind });
  };

  // Otras terminaciones con el mismo nombre.
  for (const alt of ["es", "com", "net", "co", "org", "info"]) {
    if (alt !== tld) push(`${name}.${alt}`, "tld");
  }
  // Sufijos tipicos de campanas de phishing.
  for (const suffix of ["-clientes", "-online", "-oficial", "-soporte", "-mail", "-login"]) push(`${name}${suffix}.${tld}`, "suffix");
  // Errores de teclado: letra doble, letra quitada, vecina, y homoglifos rn/m, l/1, o/0.
  if (name.length >= 4) {
    const mid = Math.floor(name.length / 2);
    push(`${name.slice(0, mid)}${name[mid]}${name.slice(mid)}.${tld}`, "typo");
    push(`${name.slice(0, mid)}${name.slice(mid + 1)}.${tld}`, "typo");
    const neighbor = KEYBOARD_NEIGHBORS[name[mid]];
    if (neighbor) push(`${name.slice(0, mid)}${neighbor}${name.slice(mid + 1)}.${tld}`, "typo");
    if (name.includes("m")) push(`${name.replace("m", "rn")}.${tld}`, "typo");
    if (name.includes("l")) push(`${name.replace("l", "1")}.${tld}`, "typo");
    if (name.includes("o")) push(`${name.replace("o", "0")}.${tld}`, "typo");
  }
  return out.slice(0, 14);
}

/**
 * ¿El dominio parecido es de la propia empresa? Si: comparte servidores de
 * nombres, sus servidores de nombres llevan el nombre de la empresa
 * (esdns1.mapfre.com para mapfre.es) o apunta a las mismas IP.
 */
export function likelyOwned(opts: { domain: string; ownNs: string[]; ownA: string[]; ns: string[]; a: string[] }): boolean {
  const name = opts.domain.slice(0, opts.domain.indexOf("."));
  const ownNs = new Set(opts.ownNs.map((h) => h.toLowerCase()));
  const ownA = new Set(opts.ownA);
  if (opts.ns.some((h) => ownNs.has(h.toLowerCase()))) return true;
  if (name.length >= 4 && opts.ns.some((h) => h.toLowerCase().split(".").includes(name))) return true;
  if (ownNs.size > 0 && opts.ns.some((h) => registrableDomain(h) === registrableDomain(opts.domain))) return true;
  return opts.a.some((ip) => ownA.has(ip));
}

/** Quita el formato Markdown que devuelve la IA (negritas, titulos) dejando las citas [n]. */
export function plainAnswer(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "· ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------- Correos publicos: extraer, clasificar y tapar ----------

const GENERIC_LOCALS = new Set([
  "info", "informacion", "información", "contacto", "contact", "hola", "hello", "admin", "administracion", "administración", "admon", "ventas", "sales",
  "soporte", "support", "rrhh", "hr", "recursoshumanos", "comercial", "prensa", "press", "marketing", "facturacion", "facturación", "billing", "noreply",
  "no-reply", "no_reply", "webmaster", "privacidad", "privacy", "dpo", "dpd", "lopd", "rgpd", "gdpr", "legal", "atencion", "atencionalcliente", "clientes",
  "customers", "reservas", "citas", "recepcion", "recepción", "pedidos", "orders", "compras", "comunicacion", "comunicación", "direccion", "gerencia",
  "secretaria", "oficina", "office", "empleo", "cv", "jobs", "trabajo", "newsletter", "ayuda", "help", "postmaster", "abuse", "hostmaster", "contabilidad",
  "correo", "mail", "email", "general", "consultas", "sugerencias", "calidad", "compliance", "tienda", "shop", "web", "registro", "notificaciones",
  "notifications", "team", "equipo", "socios", "partners", "proveedores", "atc", "sat", "seguridad", "security", "it", "sistemas", "ti", "tecnico",
]);

export function isGenericLocal(local: string): boolean {
  const clean = local.toLowerCase().replace(/[^a-z0-9áéíóúñ_.-]/g, "");
  if (GENERIC_LOCALS.has(clean)) return true;
  const stem = clean.replace(/[\d._-]+$/g, "");
  if (GENERIC_LOCALS.has(stem)) return true;
  if (/^(info|contact|soporte|support|ventas|sales|admin|noreply|no-reply)[._-]/.test(clean)) return true;
  return false;
}

/** Correos distintos de ese dominio dentro de un texto (en minusculas). */
export function extractEmails(text: string, domain: string): string[] {
  const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`[a-z0-9._%+-]+@${escaped}(?![a-z0-9-]|\\.[a-z0-9])`, "gi");
  const found = new Set<string>();
  for (const m of text.matchAll(re)) {
    const addr = m[0].toLowerCase().replace(/^[._-]+/, "");
    if (addr.length > 3) found.add(addr);
  }
  return [...found];
}

/** "ana.garcia@empresa.es" -> "an***@empresa.es". Nunca se guarda ni se muestra la direccion entera. */
export function maskEmail(address: string): string {
  const at = address.indexOf("@");
  if (at <= 0) return "***";
  const local = address.slice(0, at);
  const keep = local.length >= 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${keep}***@${address.slice(at + 1)}`;
}

export function summarizeEmails(addresses: string[], max = 10): Omit<PublicEmails, "checked"> {
  let personal = 0;
  let generic = 0;
  for (const addr of addresses) {
    if (isGenericLocal(addr.slice(0, addr.indexOf("@")))) generic += 1;
    else personal += 1;
  }
  const masked = [...new Set(addresses.map(maskEmail))].slice(0, max);
  return { total: addresses.length, personal, generic, masked };
}

// ---------- Web: cabeceras, rastreadores, banner, CMS ----------

export interface HeaderBag { get(name: string): string | null }

export function evaluateHeaders(headers: HeaderBag): Pick<WebChecks, "hsts" | "csp" | "xFrame" | "xContentType" | "serverHeader" | "poweredBy" | "versionLeak"> {
  const server = headers.get("server");
  const powered = headers.get("x-powered-by");
  const leak = [server, powered].some((v) => v && /\d+\.\d+/.test(v));
  return {
    hsts: Boolean(headers.get("strict-transport-security")),
    csp: Boolean(headers.get("content-security-policy") || headers.get("content-security-policy-report-only")),
    xFrame: Boolean(headers.get("x-frame-options")) || /frame-ancestors/i.test(headers.get("content-security-policy") ?? ""),
    xContentType: /nosniff/i.test(headers.get("x-content-type-options") ?? ""),
    serverHeader: server ? server.slice(0, 80) : null,
    poweredBy: powered ? powered.slice(0, 80) : null,
    versionLeak: Boolean(leak),
  };
}

/** Hosts de terceros referenciados en script/iframe/img/link del HTML. */
export function thirdPartyHosts(html: string, domain: string): string[] {
  const own = registrableDomain(domain);
  const hosts = new Set<string>();
  const re = /<(?:script|iframe|img|link|source|video|audio)\b[^>]*?\s(?:src|href|data-src)\s*=\s*["']?((?:https?:)?\/\/[^"'\s>]+)/gi;
  for (const m of html.matchAll(re)) {
    try {
      const host = new URL(m[1].startsWith("//") ? `https:${m[1]}` : m[1]).hostname.toLowerCase();
      if (host && registrableDomain(host) !== own) hosts.add(host);
    } catch {
      // URL rara: no cuenta.
    }
  }
  return [...hosts];
}

export type TrackerMap = Record<string, readonly [string, string] | string[]>;

/** Agrupa los hosts de terceros por empresa segun la lista de rastreadores (la de la extension). Las CDN no cuentan. */
export function detectTrackers(hosts: string[], trackers: TrackerMap): TrackerCompany[] {
  const byCompany = new Map<string, TrackerCompany>();
  for (const host of hosts) {
    const parts = host.split(".");
    for (let i = 0; i < parts.length - 1; i += 1) {
      const suffix = parts.slice(i).join(".");
      const entry = trackers[suffix];
      if (!entry) continue;
      const [company, category] = entry as [string, TrackerCategory];
      if (category === "cdn") break;
      const current = byCompany.get(company) ?? { company, category, hosts: [] };
      if (!current.hosts.includes(host)) current.hosts.push(host);
      byCompany.set(company, current);
      break;
    }
  }
  const order: Record<TrackerCategory, number> = { broker: 0, ads: 1, analytics: 2, social: 3, cdn: 4 };
  return [...byCompany.values()].sort((a, b) => order[a.category] - order[b.category] || a.company.localeCompare(b.company));
}

const BANNERS: Array<[RegExp, string]> = [
  [/cookielaw\.org|optanon|onetrust/i, "OneTrust"], [/cookiebot/i, "Cookiebot"], [/didomi/i, "Didomi"], [/cookieyes/i, "CookieYes"],
  [/cmplz|complianz/i, "Complianz"], [/borlabs/i, "Borlabs"], [/iubenda/i, "iubenda"], [/usercentrics/i, "Usercentrics"], [/axeptio/i, "Axeptio"],
  [/quantcast.*choice|consensu\.org/i, "Quantcast Choice"], [/cookie-law-info|cookielawinfo/i, "GDPR Cookie Consent"], [/tarteaucitron/i, "tarteaucitron"],
  [/klaro/i, "Klaro"], [/moove_gdpr|moove-gdpr/i, "GDPR Cookie Compliance"], [/trustarc|truste\.com/i, "TrustArc"], [/osano/i, "Osano"], [/termly/i, "Termly"],
  [/cookieconsent|cookie-consent|cookie_consent|cookiesconsent|aviso[-_ ]?cookies|cookie[-_ ]?banner|cookie[-_ ]?notice|gdpr[-_ ]?cookie|cookie[-_ ]?bar/i, "generic"],
];

export function detectCookieBanner(html: string): string | null {
  for (const [re, name] of BANNERS) if (re.test(html)) return name;
  return null;
}

export function detectCms(html: string): { cms: string | null; version: string | null } {
  const generator = /<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i.exec(html) ?? /<meta\s+content=["']([^"']+)["']\s+name=["']generator["']/i.exec(html);
  if (generator) {
    const content = generator[1].trim();
    const m = /^([A-Za-z][A-Za-z ._-]*?)\s*v?(\d+(?:\.\d+)*)?\s*$/.exec(content) ?? /^([A-Za-z][A-Za-z ._-]*)/.exec(content);
    if (m) return { cms: m[1].trim().replace(/\s+/g, " "), version: m[2] ?? null };
  }
  if (/\/wp-content\/|\/wp-includes\//i.test(html)) return { cms: "WordPress", version: null };
  if (/\/media\/jui\/|\/components\/com_/i.test(html)) return { cms: "Joomla", version: null };
  if (/drupal-settings-json|\/sites\/default\/files\//i.test(html)) return { cms: "Drupal", version: null };
  if (/prestashop/i.test(html)) return { cms: "PrestaShop", version: null };
  if (/cdn\.shopify\.com/i.test(html)) return { cms: "Shopify", version: null };
  if (/static\.wixstatic\.com|wix\.com/i.test(html)) return { cms: "Wix", version: null };
  if (/squarespace/i.test(html)) return { cms: "Squarespace", version: null };
  return { cms: null, version: null };
}

// ---------- Nota ----------

export function levelForDomain(score: number): DomainLevel {
  if (score >= 70) return "green";
  if (score >= 40) return "orange";
  return "red";
}

export function scoreDomain(s: DomainScoreSignals): { score: number; level: DomainLevel; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  if (s.spf === "missing") b.spf = -10;
  else if (s.spf !== "hard") b.spf = -5;
  if (s.dmarc === "missing") b.dmarc = -20;
  else if (s.dmarc === "none") b.dmarc = -10;
  if (!s.dkim) b.dkim = -5;
  if (!s.https) b.https = -20;
  else if (!s.hsts) b.hsts = -5;
  if (s.reachable && s.https && !s.csp) b.csp = -3;
  if (s.versionLeak) b.versionLeak = -5;
  if (s.lookalikesRegistered > 0) b.lookalikes = Math.max(-20, -5 * s.lookalikesRegistered);
  if (s.trackers >= 5) b.trackers = -5;
  if (s.personalEmails >= 3) b.personalEmails = -5;
  const score = Math.max(0, Math.min(100, 100 + Object.values(b).reduce((a, x) => a + x, 0)));
  return { score, level: levelForDomain(score), breakdown: b };
}

export function signalsFrom(report: Pick<DomainReport, "email" | "web" | "lookalikes" | "emails">): DomainScoreSignals {
  return {
    spf: report.email.spf,
    dmarc: report.email.dmarc,
    dkim: report.email.dkimSelectors.length > 0,
    reachable: report.web.reachable,
    https: report.web.https,
    hsts: report.web.hsts,
    csp: report.web.csp,
    versionLeak: report.web.versionLeak,
    lookalikesRegistered: report.lookalikes.filter((l) => l.registered && !l.likelyYours).length,
    trackers: report.web.trackers.length,
    personalEmails: report.emails.personal,
  };
}

/** Tres acciones, de mayor a menor impacto. Si todo esta bien, consejos de mantenimiento. */
export function recommendationsFor(s: DomainScoreSignals, provider: MailProvider): Recommendation[] {
  const keys: RecommendationKey[] = [];
  if (s.dmarc === "missing") keys.push("dmarc_missing");
  else if (s.dmarc === "none") keys.push("dmarc_none");
  if (s.reachable && !s.https) keys.push("https_missing");
  if (!s.reachable) keys.push("unreachable");
  if (s.spf === "missing") keys.push("spf_missing");
  else if (s.spf !== "hard") keys.push("spf_soft");
  if (s.lookalikesRegistered > 0) keys.push("lookalikes");
  if (!s.dkim) keys.push("dkim_missing");
  if (s.https && !s.hsts) keys.push("hsts_missing");
  if (s.versionLeak) keys.push("version_leak");
  if (s.personalEmails >= 3) keys.push("public_emails");
  if (s.trackers >= 5) keys.push("trackers");
  if (s.https && !s.csp) keys.push("csp_missing");
  if (s.dmarc === "quarantine") keys.push("dmarc_quarantine");
  keys.push("mfa", "passwords", "access_review");
  return keys.slice(0, 3).map((key) => ({ key, provider }));
}

// ---------- Resumen de texto (LinkedIn) ----------

export function linkedinSummary(opts: { domain: string; score: number; recommendations: string[]; url: string; lines: { title: string; actions: string; footer: string } }): string {
  return [
    opts.lines.title.replace("{domain}", opts.domain).replace("{score}", String(opts.score)),
    opts.lines.actions,
    ...opts.recommendations.slice(0, 3).map((r, i) => `${i + 1}. ${r}`),
    `${opts.lines.footer} ${opts.url}`,
  ].join("\n");
}
