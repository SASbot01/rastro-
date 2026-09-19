import { serverEnv } from "@/lib/env";
import type { Locale } from "@/lib/i18n";

/**
 * Brave Search — top 10 resultados por nombre completo (+ ciudad).
 * A Brave solo se envia nombre y ciudad, nunca el correo (CLAUDE.md seccion 9).
 */

const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";
const TIMEOUT_MS = 10_000;
const RESULT_COUNT = 10;

/** Dominios que casi siempre son un perfil personal. */
const PROFILE_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)facebook\.com$/, "Facebook"],
  [/(^|\.)(x|twitter)\.com$/, "X"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)youtube\.com$/, "YouTube"],
  [/(^|\.)github\.com$/, "GitHub"],
  [/(^|\.)crunchbase\.com$/, "Crunchbase"],
  [/(^|\.)threads\.net$/, "Threads"],
  [/(^|\.)pinterest\.[a-z.]+$/, "Pinterest"],
  [/(^|\.)about\.me$/, "About.me"],
  [/(^|\.)medium\.com$/, "Medium"],
  [/(^|\.)infojobs\.net$/, "InfoJobs"],
  [/(^|\.)xing\.com$/, "Xing"],
];

/** Sitios que recopilan y venden datos personales (telefono, direccion). */
const BROKER_HOSTS = [
  /(^|\.)spokeo\.com$/, /(^|\.)rocketreach\.co$/, /(^|\.)zabasearch\.com$/, /(^|\.)whitepages\.com$/,
  /(^|\.)beenverified\.com$/, /(^|\.)truepeoplesearch\.com$/, /(^|\.)fastpeoplesearch\.com$/,
  /(^|\.)radaris\.com$/, /(^|\.)mylife\.com$/, /(^|\.)peoplefinders\.com$/, /(^|\.)intelius\.com$/,
  /(^|\.)dateas\.com$/, /(^|\.)infobel\.com$/, /(^|\.)signalhire\.com$/, /(^|\.)contactout\.com$/,
  /(^|\.)lusha\.com$/, /(^|\.)apollo\.io$/, /(^|\.)zoominfo\.com$/, /(^|\.)cylex[a-z.-]*$/,
  /(^|\.)paginasamarillas\.[a-z.]+$/, /(^|\.)nuwber\.com$/, /(^|\.)clustrmaps\.com$/,
];

interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
  extra_snippets?: string[];
  meta_url?: { hostname?: string };
  profile?: { name?: string };
}

interface BraveResponse {
  query?: { original?: string };
  web?: { results?: BraveWebResult[] };
}

export interface SearchHit {
  title: string;
  url: string;
  hostname: string;
  /** Descripcion + snippets extra, ya limpios de HTML. */
  snippet: string;
  /** "profile": red social/perfil conocido. "broker": sitio que vende datos personales. */
  kind: "profile" | "broker" | "page";
  /** Nombre legible del sitio de perfil, p. ej. "LinkedIn". */
  platform?: string;
}

export type BraveResult =
  | { ok: true; query: string; hits: SearchHit[]; raw: BraveResponse }
  | { ok: false; query: string; reason: "unauthorized" | "rate_limited" | "error"; detail?: string };

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function classify(hostname: string): { kind: SearchHit["kind"]; platform?: string } {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  for (const [pattern, platform] of PROFILE_HOSTS) {
    if (pattern.test(host)) return { kind: "profile", platform };
  }
  if (BROKER_HOSTS.some((pattern) => pattern.test(host))) return { kind: "broker" };
  return { kind: "page" };
}

function toHit(r: BraveWebResult): SearchHit {
  let hostname = r.meta_url?.hostname ?? "";
  if (!hostname) {
    try {
      hostname = new URL(r.url).hostname;
    } catch {
      hostname = "";
    }
  }
  const snippet = stripHtml([r.description ?? "", ...(r.extra_snippets ?? [])].join(" "));
  return { title: stripHtml(r.title), url: r.url, hostname, snippet, ...classify(hostname) };
}

export function buildNameQuery(fullName: string, city?: string | null, occupation?: string | null): string {
  return [`"${fullName.trim()}"`, city?.trim(), occupation?.trim()].filter(Boolean).join(" ");
}

export async function searchName(opts: {
  fullName: string;
  city?: string | null;
  occupation?: string | null;
  locale: Locale;
}): Promise<BraveResult> {
  return searchRaw(buildNameQuery(opts.fullName, opts.city, opts.occupation), opts.locale, RESULT_COUNT);
}

/** Busqueda web con una consulta ya montada (la usa tambien la comprobacion de sitios con site:). */
export async function searchRaw(query: string, locale: Locale, count: number): Promise<BraveResult> {
  const params = new URLSearchParams({
    q: query,
    count: String(count),
    search_lang: locale,
    safesearch: "off",
    text_decorations: "0",
    extra_snippets: "1",
  });

  let response: Response;
  try {
    response = await fetch(`${BRAVE_URL}?${params}`, {
      headers: {
        accept: "application/json",
        "accept-encoding": "gzip",
        "x-subscription-token": serverEnv.braveApiKey,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    return { ok: false, query, reason: "error", detail: String(error) };
  }

  if (response.status === 401 || response.status === 403) return { ok: false, query, reason: "unauthorized" };
  if (response.status === 429) return { ok: false, query, reason: "rate_limited" };
  if (!response.ok) return { ok: false, query, reason: "error", detail: `HTTP ${response.status}` };

  const raw = (await response.json()) as BraveResponse;
  const hits = (raw.web?.results ?? []).slice(0, count).map(toHit);
  return { ok: true, query, hits, raw };
}


export interface ImageHit {
  title: string;
  /** Pagina donde esta la imagen. */
  pageUrl: string;
  hostname: string;
  thumbnail: string;
  /** URL de la imagen original, si Brave la da. */
  imageUrl: string | null;
}

/**
 * v4 — imagenes publicas asociadas al nombre (Brave Images). Solo nombre y
 * ciudad, safesearch estricto. Si el plan no incluye imagenes, devuelve ok:false.
 */
export async function searchImages(opts: { fullName: string; city?: string | null; count?: number }): Promise<{ ok: true; hits: ImageHit[] } | { ok: false; reason: string }> {
  const q = [`"${opts.fullName}"`, opts.city ?? ""].filter(Boolean).join(" ");
  const params = new URLSearchParams({ q, count: String(opts.count ?? 24), safesearch: "strict" });
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/images/search?${params}`, {
      headers: { accept: "application/json", "x-subscription-token": serverEnv.braveApiKey },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; thumbnail?: { src?: string }; properties?: { url?: string } }> };
    const hits: ImageHit[] = [];
    for (const r of data.results ?? []) {
      if (!r.url || !r.thumbnail?.src) continue;
      let hostname = "";
      try { hostname = new URL(r.url).hostname.replace(/^www\./, ""); } catch { continue; }
      hits.push({ title: r.title ?? "", pageUrl: r.url, hostname, thumbnail: r.thumbnail.src, imageUrl: r.properties?.url ?? null });
    }
    return { ok: true, hits };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 120) };
  }
}
