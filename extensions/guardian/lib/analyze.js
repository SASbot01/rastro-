import { COOKIE_NAMES, TRACKER_DOMAINS } from "./trackers.js";

/**
 * Motor de cookies de Rastro Guardian. Puro: recibe lo que el navegador ya
 * sabe (cookies del sitio y de los terceros que carga) y devuelve un resumen
 * con nota 0-100. No usa ni devuelve VALORES de cookies: solo nombre,
 * dominio, caducidad y banderas.
 *
 * @typedef {{name:string, domain:string, expirationDate?:number, session?:boolean, secure?:boolean, httpOnly?:boolean, sameSite?:string}} CookieMeta
 */

const DAY = 86_400;
const LONG_LIVED_DAYS = 395; // > 13 meses (criterio habitual de las autoridades de proteccion de datos)

export function baseDomain(host) {
  const h = String(host || "").toLowerCase().replace(/^\./, "").replace(/^www\./, "");
  const parts = h.split(".");
  if (parts.length <= 2) return h;
  const twoLevel = new Set(["co.uk", "com.es", "org.es", "com.mx", "com.ar", "com.br", "com.co", "co.jp", "com.au", "gob.es", "edu.es"]);
  const last2 = parts.slice(-2).join(".");
  return twoLevel.has(last2) ? parts.slice(-3).join(".") : last2;
}

export function trackerFor(host) {
  const h = String(host || "").toLowerCase().replace(/^\./, "");
  for (const domain of Object.keys(TRACKER_DOMAINS)) {
    if (h === domain || h.endsWith("." + domain)) return { company: TRACKER_DOMAINS[domain][0], category: TRACKER_DOMAINS[domain][1] };
  }
  return null;
}

/** Clasifica una cookie por nombre y, si no, por dominio. */
export function classifyCookie(cookie, siteHost) {
  const name = cookie.name || "";
  const known = COOKIE_NAMES.find(([prefix]) => (prefix.length <= 3 ? name === prefix : name === prefix || name.startsWith(prefix)));
  const thirdParty = baseDomain(cookie.domain) !== baseDomain(siteHost);
  if (known) return { company: known[1] || null, category: known[2], thirdParty };
  const t = trackerFor(cookie.domain);
  if (t && t.category !== "cdn") return { company: t.company, category: t.category, thirdParty };
  return { company: null, category: thirdParty ? "unknown-third" : "other", thirdParty };
}

/**
 * @param {{siteHost:string, cookies:CookieMeta[], thirdPartyHosts?:string[], bannerVisible?:boolean, now?:number, https?:boolean}} input
 */
export function analyzeCookies(input) {
  const now = input.now ?? Date.now() / 1000;
  const seen = new Set();
  const cookies = [];
  for (const c of input.cookies || []) {
    const key = `${c.name}|${String(c.domain).replace(/^\./, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cls = classifyCookie(c, input.siteHost);
    const days = c.session || !c.expirationDate ? 0 : Math.max(0, Math.round((c.expirationDate - now) / DAY));
    cookies.push({ name: c.name, domain: String(c.domain).replace(/^\./, ""), days, session: Boolean(c.session || !c.expirationDate), secure: Boolean(c.secure), httpOnly: Boolean(c.httpOnly), ...cls });
  }

  const count = (f) => cookies.filter(f).length;
  const tracking = cookies.filter((c) => ["ads", "analytics", "social", "broker"].includes(c.category));
  const adLike = cookies.filter((c) => c.category === "ads" || c.category === "broker" || c.category === "social");

  // Empresas: por cookies y por los terceros que la pagina carga (aunque no dejen cookie legible).
  const companies = new Map();
  const addCompany = (company, category) => {
    if (!company) return;
    const cur = companies.get(company);
    const rank = { broker: 0, ads: 1, social: 2, analytics: 3 };
    if (!cur || (rank[category] ?? 9) < (rank[cur] ?? 9)) companies.set(company, category);
  };
  for (const c of tracking) addCompany(c.company, c.category);
  for (const host of input.thirdPartyHosts || []) {
    if (baseDomain(host) === baseDomain(input.siteHost)) continue;
    const t = trackerFor(host);
    if (t && t.category !== "cdn") addCompany(t.company, t.category);
  }
  const companyList = [...companies.entries()].map(([company, category]) => ({ company, category })).sort((a, b) => a.company.localeCompare(b.company));

  const longLived = tracking.filter((c) => c.days > LONG_LIVED_DAYS);
  const maxDays = cookies.reduce((m, c) => Math.max(m, c.days), 0);
  // Solo cookies que son claramente la sesion de la cuenta (nombres estandar), no cualquier "token".
  const SESSION_NAME = /^(PHPSESSID|JSESSIONID|ASP\.NET_SessionId|connect\.sid|sessionid|session|sid|wordpress_logged_in.*)$/i;
  const weakSession = cookies.filter((c) => !c.thirdParty && SESSION_NAME.test(c.name) && (!c.httpOnly || (input.https !== false && !c.secure)));
  const brokers = companyList.filter((c) => c.category === "broker");
  const beforeConsent = Boolean(input.bannerVisible) && adLike.length > 0;

  const flags = [];
  if (beforeConsent) flags.push({ code: "before_consent", severity: "high", n: adLike.length });
  if (brokers.length) flags.push({ code: "data_brokers", severity: "high", n: brokers.length });
  if (longLived.length) flags.push({ code: "long_lived", severity: "medium", n: longLived.length, years: Math.round((Math.max(...longLived.map((c) => c.days)) / 365) * 10) / 10 });
  if (weakSession.length) flags.push({ code: "weak_session", severity: "medium", n: weakSession.length });
  if (companyList.length >= 10) flags.push({ code: "many_companies", severity: "medium", n: companyList.length });
  if (input.https === false) flags.push({ code: "no_https", severity: "high", n: 1 });

  // Nota: 100 = respetuosa. Penaliza lo que afecta a la persona, no el numero bruto de cookies.
  let score = 100;
  score -= Math.min(36, companyList.filter((c) => c.category === "ads" || c.category === "social").length * 4);
  score -= Math.min(24, brokers.length * 8);
  score -= Math.min(10, companyList.filter((c) => c.category === "analytics").length * 2);
  if (beforeConsent) score -= 25;
  if (longLived.length) score -= 8;
  if (weakSession.length) score -= 8;
  if (input.https === false) score -= 20;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 70 ? "green" : score >= 40 ? "orange" : "red";

  return {
    siteHost: input.siteHost,
    bannerVisible: Boolean(input.bannerVisible),
    score,
    level,
    counts: {
      total: cookies.length,
      necessary: count((c) => c.category === "necessary"),
      analytics: count((c) => c.category === "analytics"),
      ads: count((c) => c.category === "ads" || c.category === "social"),
      broker: count((c) => c.category === "broker"),
      other: count((c) => c.category === "other" || c.category === "unknown-third"),
      thirdParty: count((c) => c.thirdParty),
      companies: companyList.length,
      maxDays,
    },
    companies: companyList,
    flags,
    // Detalle sin valores: nombre, dominio, dias, categoria.
    cookies: cookies.map(({ name, domain, days, session, category, company, thirdParty }) => ({ name, domain, days, session, category, company, thirdParty })),
  };
}

const T = {
  es: {
    clean: "Esta web casi no te rastrea. Bien.",
    waiting_consent: "De momento no te rastrea: está esperando a que decidas en el aviso de cookies. Vuelvo a mirar cuando elijas.",
    total: (r) => `Esta web te ha puesto ${r.counts.total} cookie${r.counts.total === 1 ? "" : "s"}: ${r.counts.necessary} necesaria${r.counts.necessary === 1 ? "" : "s"}, ${r.counts.analytics} de medición, ${r.counts.ads + r.counts.broker} de publicidad o redes${r.counts.other ? ` y ${r.counts.other} que no reconocemos` : ""}.`,
    companies: (r) => `Te siguen ${r.counts.companies} empresa${r.counts.companies === 1 ? "" : "s"}: ${r.companies.slice(0, 5).map((c) => c.company).join(", ")}${r.companies.length > 5 ? "…" : ""}.`,
    before_consent: (f) => `Te puso ${f.n} cookie${f.n === 1 ? "" : "s"} de publicidad antes de que aceptaras nada. En la UE eso no está permitido.`,
    data_brokers: (f) => (f.n === 1 ? "Una de esas empresas se dedica a comprar y vender perfiles de personas." : `${f.n} de esas empresas se dedican a comprar y vender perfiles de personas.`),
    long_lived: (f) => `Algunas cookies de seguimiento duran ${String(f.years).replace(".", ",")} años.`,
    weak_session: () => "La cookie de tu sesión no está bien protegida: si alguien la roba, entra en tu cuenta.",
    many_companies: (f) => `${f.n} empresas distintas en una sola página es mucho.`,
    no_https: () => "La página no usa conexión cifrada (https). No metas contraseñas ni tarjetas.",
  },
  en: {
    clean: "This site barely tracks you. Good.",
    waiting_consent: "It isn't tracking you yet: it's waiting for your choice on the cookie banner. I'll look again once you choose.",
    total: (r) => `This site set ${r.counts.total} cookie${r.counts.total === 1 ? "" : "s"}: ${r.counts.necessary} necessary, ${r.counts.analytics} for analytics, ${r.counts.ads + r.counts.broker} for ads or social${r.counts.other ? ` and ${r.counts.other} we don't recognise` : ""}.`,
    companies: (r) => `${r.counts.companies} compan${r.counts.companies === 1 ? "y follows" : "ies follow"} you here: ${r.companies.slice(0, 5).map((c) => c.company).join(", ")}${r.companies.length > 5 ? "…" : ""}.`,
    before_consent: (f) => `It set ${f.n} advertising cookie${f.n === 1 ? "" : "s"} before you accepted anything. That's not allowed in the EU.`,
    data_brokers: (f) => (f.n === 1 ? "One of those companies buys and sells profiles of people." : `${f.n} of those companies buy and sell profiles of people.`),
    long_lived: (f) => `Some tracking cookies last ${f.years} years.`,
    weak_session: () => "Your session cookie isn't well protected: if someone steals it, they're in your account.",
    many_companies: (f) => `${f.n} different companies on a single page is a lot.`,
    no_https: () => "This page isn't encrypted (https). Don't type passwords or card numbers.",
  },
};

/** Frases en lenguaje llano para la burbuja del robot. */
export function summarize(report, locale = "es") {
  const t = T[locale === "en" ? "en" : "es"];
  const lines = [];
  if (report.counts.companies === 0 && report.flags.length === 0) lines.push(report.bannerVisible ? t.waiting_consent : t.clean);
  lines.push(t.total(report));
  if (report.counts.companies > 0) lines.push(t.companies(report));
  for (const f of report.flags) if (t[f.code]) lines.push(t[f.code](f));
  return lines;
}
