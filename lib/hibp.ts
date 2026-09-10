import { serverEnv } from "@/lib/env";

/**
 * Have I Been Pwned v3 — brechas por correo.
 * A HIBP solo se envia el correo, nada mas (CLAUDE.md seccion 9).
 */

const HIBP_BASE = "https://haveibeenpwned.com/api/v3";
const USER_AGENT = "Rastro (informe de exposicion personal)";
const TIMEOUT_MS = 10_000;

/** Respuesta cruda de HIBP, solo los campos que usamos. */
interface HibpBreach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  PwnCount: number;
  DataClasses: string[];
  IsVerified: boolean;
  IsSensitive: boolean;
  IsSpamList: boolean;
  IsStealerLog: boolean;
  IsFabricated: boolean;
}

export interface Breach {
  name: string;
  title: string;
  domain: string;
  /** YYYY-MM-DD */
  date: string;
  pwnCount: number;
  dataClasses: string[];
  /** Se filtraron contrasenas (hash o en claro). Es lo que mas pesa en el score. */
  hasPassword: boolean;
  isVerified: boolean;
  isSensitive: boolean;
  isStealerLog: boolean;
}

export type HibpResult =
  | { checked: true; breaches: Breach[]; raw: HibpBreach[] }
  | { checked: false; reason: "no_key" | "unauthorized" | "rate_limited" | "error"; detail?: string };

function toBreach(b: HibpBreach): Breach {
  return {
    name: b.Name,
    title: b.Title,
    domain: b.Domain,
    date: b.BreachDate,
    pwnCount: b.PwnCount,
    dataClasses: b.DataClasses,
    hasPassword: b.DataClasses.some((c) => /password/i.test(c)),
    isVerified: b.IsVerified,
    isSensitive: b.IsSensitive,
    isStealerLog: b.IsStealerLog,
  };
}

export async function getBreaches(email: string): Promise<HibpResult> {
  const key = serverEnv.hibpApiKey;
  if (!key) return { checked: false, reason: "no_key" };

  const url = `${HIBP_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "hibp-api-key": key, "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    return { checked: false, reason: "error", detail: String(error) };
  }

  // 404 es la respuesta normal de HIBP cuando el correo no esta en ninguna brecha.
  if (response.status === 404) return { checked: true, breaches: [], raw: [] };
  if (response.status === 401) return { checked: false, reason: "unauthorized" };
  if (response.status === 429) {
    return { checked: false, reason: "rate_limited", detail: response.headers.get("retry-after") ?? undefined };
  }
  if (!response.ok) {
    return { checked: false, reason: "error", detail: `HTTP ${response.status}` };
  }

  const raw = (await response.json()) as HibpBreach[];
  const breaches = raw
    // Las listas de spam y las fabricadas no son brechas reales de un servicio.
    .filter((b) => !b.IsSpamList && !b.IsFabricated)
    .map(toBreach)
    .sort((a, b) => b.date.localeCompare(a.date));

  return { checked: true, breaches, raw };
}

export interface Paste {
  source: string;
  id: string;
  title: string | null;
  /** ISO, puede faltar */
  date: string | null;
  emailCount: number;
}

export type PastesResult =
  | { checked: true; pastes: Paste[] }
  | { checked: false; reason: "no_key" | "unauthorized" | "rate_limited" | "error"; detail?: string };

/** Volcados publicos ("pastes") donde aparece el correo. 404 = ninguno. */
export async function getPastes(email: string): Promise<PastesResult> {
  const key = serverEnv.hibpApiKey;
  if (!key) return { checked: false, reason: "no_key" };
  let response: Response;
  try {
    response = await fetch(`${HIBP_BASE}/pasteaccount/${encodeURIComponent(email)}`, {
      headers: { "hibp-api-key": key, "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    return { checked: false, reason: "error", detail: String(error) };
  }
  if (response.status === 404) return { checked: true, pastes: [] };
  if (response.status === 401) return { checked: false, reason: "unauthorized" };
  if (response.status === 429) return { checked: false, reason: "rate_limited" };
  if (!response.ok) return { checked: false, reason: "error", detail: `HTTP ${response.status}` };
  const raw = (await response.json()) as Array<{ Source: string; Id: string; Title?: string | null; Date?: string | null; EmailCount: number }>;
  return {
    checked: true,
    pastes: raw.map((p) => ({ source: p.Source, id: p.Id, title: p.Title ?? null, date: p.Date ?? null, emailCount: p.EmailCount })),
  };
}
