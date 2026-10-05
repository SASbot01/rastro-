/**
 * Centinela Rastro (Equipos) — lógica pura, sin red ni BD (con tests).
 *
 * Las apps del cliente (su CRM, su panel…) envían eventos de seguridad a la API
 * de Rastro. Esto NO es un IDS: la app decide qué evento manda y con qué gravedad.
 * Aquí solo saneamos el evento entrante y decidimos si merece avisar al titular.
 */

export const SENTINEL_SEVERITIES = ["info", "warn", "critical"] as const;
export type SentinelSeverity = (typeof SENTINEL_SEVERITIES)[number];

export interface SentinelEventInput {
  kind?: unknown;
  severity?: unknown;
  source?: unknown;
  actor?: unknown;
  ip?: unknown;
  country?: unknown;
  message?: unknown;
  meta?: unknown;
}

export interface CleanSentinelEvent {
  kind: string;
  severity: SentinelSeverity;
  source: string | null;
  actor: string | null;
  ip: string | null;
  country: string | null;
  message: string | null;
  meta: Record<string, unknown> | null;
}

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/**
 * Sanea un evento entrante. Devuelve null si falta `kind` (lo único obligatorio).
 * Recorta todas las cadenas, valida la gravedad (por defecto "info") y limita
 * el tamaño de `meta` para que nadie use el Centinela como almacén.
 */
export function normalizeSentinelEvent(input: SentinelEventInput): CleanSentinelEvent | null {
  const kind = str(input.kind, 60);
  if (!kind) return null;
  const severity: SentinelSeverity =
    typeof input.severity === "string" && (SENTINEL_SEVERITIES as readonly string[]).includes(input.severity)
      ? (input.severity as SentinelSeverity)
      : "info";
  let meta: Record<string, unknown> | null = null;
  if (input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)) {
    try {
      if (JSON.stringify(input.meta).length <= 4000) meta = input.meta as Record<string, unknown>;
    } catch {
      meta = null;
    }
  }
  return {
    kind: kind.toLowerCase().replace(/\s+/g, "_"),
    severity,
    source: str(input.source, 120),
    actor: str(input.actor, 200),
    ip: str(input.ip, 60),
    country: str(input.country, 80),
    message: str(input.message, 500),
    meta,
  };
}

/** Solo avisamos al titular de los eventos críticos; el resto se guardan y se ven en el panel. */
export function isNotifiable(ev: Pick<CleanSentinelEvent, "severity">): boolean {
  return ev.severity === "critical";
}
