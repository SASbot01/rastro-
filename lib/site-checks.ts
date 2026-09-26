import { BROKERS, type Broker } from "@/lib/brokers/catalog";
import { searchRaw, type SearchHit } from "@/lib/brave";
import { buildSiteQueries, resolveGroup, type SiteCheck, type SiteTarget } from "@/lib/site-checks-core";
import type { Locale } from "@/lib/i18n";

export * from "@/lib/site-checks-core";

/** Redes sociales y buscadores no se comprueban aqui: ya salen en la busqueda general por nombre. */
const SKIP_KINDS = new Set<Broker["kind"]>(["results"]);
const SKIP_SLUGS = new Set(["instagram", "linkedin", "facebook", "strava"]);

/** Sitios a comprobar segun la persona: España e internacionales siempre; los de EE. UU. solo en ingles. */
export function targetsFor(locale: Locale): SiteTarget[] {
  return BROKERS.filter((b) => !SKIP_KINDS.has(b.kind) && !SKIP_SLUGS.has(b.slug) && (b.country !== "US" || locale === "en")).map((b) => ({ slug: b.slug, name: b.name, hosts: b.hosts }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Comprueba los sitios del catalogo para una persona. Al buscador solo va el
 * nombre (CLAUDE.md s.9). Las consultas van en serie con una pausa: el plan
 * basico del buscador admite 1 por segundo, y esto corre en paralelo con las
 * preguntas a las IA, asi que no alarga el informe. Nunca lanza.
 */
export async function checkSites(opts: { fullName: string; locale: Locale }): Promise<{ checks: SiteCheck[]; hits: SearchHit[]; queries: number }> {
  const groups = buildSiteQueries(opts.fullName, targetsFor(opts.locale));
  const checks: SiteCheck[] = [];
  const hits: SearchHit[] = [];
  let queries = 0;
  for (const [i, g] of groups.entries()) {
    if (i > 0) await sleep(1100);
    let res = await searchRaw(g.query, opts.locale, 20);
    if (!res.ok && res.reason === "rate_limited") { await sleep(1500); res = await searchRaw(g.query, opts.locale, 20); }
    queries += 1;
    const resolved = resolveGroup(opts.fullName, g.targets, res.ok ? res.hits : null);
    checks.push(...resolved);
    if (res.ok) for (const c of resolved) { const h = c.url ? res.hits.find((x) => x.url === c.url) : null; if (h) hits.push({ ...h, kind: "broker" }); }
  }
  return { checks, hits, queries };
}
