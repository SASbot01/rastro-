// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Diferencias entre dos informes de la misma persona, con senales
 * deterministas (no con el texto de la IA, que cambia en cada redaccion):
 * filtraciones, perfiles atribuidos, sitios de venta de datos, senales de
 * la IA y score. Sirve para el correo mensual de novedades.
 *
 * Regla de oro: solo se compara lo que se pudo mirar en LOS DOS informes. Si
 * este mes fallo una fuente (HIBP caido, buscador con limite, IA en plantilla),
 * su lista viene vacia, y "vacio" no significa "ya no apareces": sin esta regla
 * el correo decia "ya no sales en la filtracion X" o "sitio nuevo: Y" en falso.
 */

export interface SiteCheckLike { slug: string; status: string; url: string | null }

interface RawShape {
  hibp?: { checked: boolean; breaches?: Array<{ name: string; title: string }> };
  brave?: { ok: boolean; hits?: Array<{ url: string; hostname: string; kind: string }> };
  ai?: {
    signals?: { knows_employer: boolean; knows_city: boolean; contact_data_public: boolean; false_claims: boolean };
    attributed_profile_urls?: string[];
  };
}

export interface ReportSnapshot {
  score: number;
  raw: RawShape | null;
  /** Comprobacion de sitios del catalogo (reports.site_checks). null/ausente = ese informe no la hizo. */
  site_checks?: SiteCheckLike[] | null;
}

type SignalKey = "knows_employer" | "knows_city" | "contact_data_public" | "false_claims";
const SIGNAL_KEYS: SignalKey[] = ["knows_employer", "knows_city", "contact_data_public", "false_claims"];

export interface ReportDiff {
  changed: boolean;
  score_before: number;
  score_after: number;
  new_breaches: string[];
  gone_breaches: string[];
  new_profiles: string[];
  gone_profiles: string[];
  new_brokers: string[];
  gone_brokers: string[];
  signals_on: SignalKey[];
  signals_off: SignalKey[];
}

function breachNames(r: RawShape | null): Set<string> | null {
  return r?.hibp?.checked ? new Set((r.hibp.breaches ?? []).map((b) => b.title || b.name)) : null;
}
function profileUrls(r: RawShape | null): Set<string> | null {
  return Array.isArray(r?.ai?.attributed_profile_urls) ? new Set(r.ai.attributed_profile_urls) : null;
}

interface BrokerSeen { organic: boolean; slugs: string[] }

/** Sitios de datos de un informe: host -> si salio en la busqueda por nombre (organic) y/o por que comprobacion de sitio. */
function brokers(s: ReportSnapshot): Map<string, BrokerSeen> | null {
  if (!s.raw?.brave?.ok) return null;
  const listed = new Map<string, string>();
  for (const c of s.site_checks ?? []) if (c.status === "listed" && c.url) listed.set(c.url, c.slug);
  const out = new Map<string, BrokerSeen>();
  for (const h of s.raw.brave.hits ?? []) {
    if (h.kind !== "broker") continue;
    const host = h.hostname.replace(/^www\./, "");
    const seen = out.get(host) ?? { organic: false, slugs: [] };
    const slug = listed.get(h.url);
    if (slug) seen.slugs.push(slug);
    else seen.organic = true;
    out.set(host, seen);
  }
  return out;
}

function siteStatus(s: ReportSnapshot, slug: string): string | null {
  return (s.site_checks ?? []).find((c) => c.slug === slug)?.status ?? null;
}

function onlyIn<T>(a: Set<T>, b: Set<T>): T[] {
  return [...a].filter((x) => !b.has(x));
}

export function diffReports(prev: ReportSnapshot, next: ReportSnapshot): ReportDiff {
  const pb = breachNames(prev.raw), nb = breachNames(next.raw);
  const pp = profileUrls(prev.raw), np = profileUrls(next.raw);
  const pk = brokers(prev), nk = brokers(next);
  const ps = prev.raw?.ai?.signals, ns = next.raw?.ai?.signals;

  let newBrokers: string[] = [], goneBrokers: string[] = [];
  if (pk && nk) {
    // Nuevo: si solo lo vemos por la comprobacion de sitios, el informe anterior tuvo que mirar ESE sitio y no encontrarlo.
    newBrokers = [...nk.entries()]
      .filter(([host, seen]) => !pk.has(host) && (seen.organic || seen.slugs.some((slug) => siteStatus(prev, slug) === "not_found")))
      .map(([host]) => host);
    // Retirado: si antes solo lo veiamos por la comprobacion de sitios, la de ahora tiene que haber mirado y no encontrarlo.
    goneBrokers = [...pk.entries()]
      .filter(([host, seen]) => !nk.has(host) && (seen.organic || seen.slugs.every((slug) => siteStatus(next, slug) === "not_found")))
      .map(([host]) => host);
  }

  const d: ReportDiff = {
    changed: false,
    score_before: prev.score,
    score_after: next.score,
    new_breaches: pb && nb ? onlyIn(nb, pb) : [],
    gone_breaches: pb && nb ? onlyIn(pb, nb) : [],
    new_profiles: pp && np ? onlyIn(np, pp) : [],
    gone_profiles: pp && np ? onlyIn(pp, np) : [],
    new_brokers: newBrokers,
    gone_brokers: goneBrokers,
    // Las senales solo cuentan si ambos informes las tienen (si no, no hay con que comparar).
    signals_on: ps && ns ? SIGNAL_KEYS.filter((k) => !ps[k] && ns[k]) : [],
    signals_off: ps && ns ? SIGNAL_KEYS.filter((k) => ps[k] && !ns[k]) : [],
  };
  // Un salto de score que viene de una fuente que no se pudo mirar no es una novedad de la persona.
  const comparable = Boolean(pb && nb) && Boolean(ps) === Boolean(ns);
  d.changed =
    d.new_breaches.length + d.gone_breaches.length + d.new_profiles.length + d.gone_profiles.length +
      d.new_brokers.length + d.gone_brokers.length + d.signals_on.length + d.signals_off.length > 0 ||
    // La redaccion de la IA introduce ruido: un cambio solo de score cuenta si es grande.
    (comparable && Math.abs(d.score_after - d.score_before) >= 15);
  return d;
}
