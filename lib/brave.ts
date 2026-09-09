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
  /** "profile" si el dominio es una red social/perfil conocido. */
  kind: "profile" | "page";
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

export function buildNameQuery(fullName: string, city?: string | null): string {
  const name = `"${fullName.trim()}"`;
  return city?.trim() ? `${name} ${city.trim()}` : name;
}

export async function searchName(opts: {
  fullName: string;
  city?: string | null;
  locale: Locale;
}): Promise<BraveResult> {
  const query = buildNameQuery(opts.fullName, opts.city);
  const params = new URLSearchParams({
    q: query,
    count: String(RESULT_COUNT),
    search_lang: opts.locale,
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
  const hits = (raw.web?.results ?? []).slice(0, RESULT_COUNT).map(toHit);
  return { ok: true, query, hits, raw };
}
