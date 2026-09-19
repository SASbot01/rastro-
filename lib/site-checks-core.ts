// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Comprobacion real de los sitios del catalogo: "¿sale esta persona en
 * dateas, axesor, infobel...?". Se pregunta al buscador con el operador
 * site: agrupando varios sitios por consulta (coste: 3-4 busquedas por
 * informe, no 20), y solo cuenta como "apareces" un resultado cuyo titulo o
 * texto contiene el nombre completo.
 */

export type SiteStatus = "listed" | "not_found" | "unknown";

export interface SiteTarget { slug: string; name: string; hosts: string[] }

export interface SiteCheck {
  slug: string;
  name: string;
  host: string;
  status: SiteStatus;
  url: string | null;
  title: string | null;
}

export interface HitLike { title: string; url: string; hostname: string; snippet: string }

export function foldText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * El nombre completo aparece junto: todas sus partes (de mas de 2 letras) dentro de una ventana
 * de pocas palabras seguidas, en cualquier orden ("RUIZ GARCIA, ANA"). Evita dar por bueno
 * "Ana García López ... Ruiz y asociados", que junta trozos de personas distintas.
 */
export function mentionsName(text: string, fullName: string): boolean {
  const parts = foldText(fullName).split(" ").filter((p) => p.length > 2);
  if (parts.length < 2) return false;
  const words = foldText(text).split(" ");
  const span = parts.length + 1; // admite una palabra intercalada ("Ana María García Ruiz")
  for (let i = 0; i + parts.length <= words.length; i++) {
    const win = new Set(words.slice(i, i + span));
    if (parts.every((p) => win.has(p))) return true;
  }
  return false;
}

export function hostMatches(hostname: string, hosts: string[]): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return hosts.some((x) => h === x || h.endsWith("." + x));
}

/** Consultas agrupadas: "Nombre Apellidos" (site:a OR site:b ...). */
export function buildSiteQueries(fullName: string, targets: SiteTarget[], perQuery = 5): Array<{ query: string; targets: SiteTarget[] }> {
  const out: Array<{ query: string; targets: SiteTarget[] }> = [];
  for (let i = 0; i < targets.length; i += perQuery) {
    const group = targets.slice(i, i + perQuery);
    const sites = group.map((t) => `site:${t.hosts[0]}`).join(" OR ");
    out.push({ query: `"${fullName.trim()}" (${sites})`, targets: group });
  }
  return out;
}

/** Resultado por sitio de un grupo: el primer resultado del sitio que nombra a la persona. */
export function resolveGroup(fullName: string, targets: SiteTarget[], hits: HitLike[] | null): SiteCheck[] {
  return targets.map((t) => {
    const base = { slug: t.slug, name: t.name, host: t.hosts[0] };
    if (!hits) return { ...base, status: "unknown" as const, url: null, title: null };
    const hit = hits.find((h) => hostMatches(h.hostname, t.hosts) && (mentionsName(h.title, fullName) || mentionsName(h.snippet, fullName)));
    return hit ? { ...base, status: "listed" as const, url: hit.url, title: hit.title.slice(0, 160) } : { ...base, status: "not_found" as const, url: null, title: null };
  });
}
