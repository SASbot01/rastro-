// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Retiradas verificadas. La promesa de Rastro no es "borramos", es "te lo
 * enseñamos y lo medimos": de los sitios donde apareces, a cuantos se lo has
 * pedido y en cuantos hemos comprobado que ya no sales.
 *
 * Regla para dar un dato por retirado (conservadora, para no cantar victoria
 * en falso): la pagina devuelve 404/410, o antes aparecia el nombre y ahora
 * no. Si nunca lo vimos aparecer (pagina con JS, bloqueo), queda "sin
 * confirmar" y solo cuenta si la persona marca el resultado como 'deleted'.
 */

export interface RemovalEvent { at: string; type: string; to?: string; note?: string }

export interface CheckResult {
  /** true = sigue apareciendo; false = no aparece; null = no se pudo comprobar. */
  listed: boolean | null;
  /** La pagina ya no existe (404/410). */
  httpGone: boolean;
}

export interface RemovalLetter {
  id: string;
  host: string;
  status: string;
  kind?: string | null;
  outcome: string | null;
  still_listed: boolean | null;
  removed_at: string | null;
  deadline_at: string | null;
}

export interface RemovalStats {
  /** Sitios distintos donde aparece la persona (hallazgos con URL + cartas). */
  found: number;
  /** Sitios a los que ya se les ha pedido la retirada (cartas enviadas). */
  requested: number;
  /** Sitios donde se ha comprobado que el dato ya no esta. */
  removed: number;
  /** Pedidos y aun dentro de plazo o sin resultado. */
  pending: number;
  /** Pedidos con el plazo de un mes vencido y sin retirar. */
  overdue: number;
  refused: number;
  /** removed / found, 0-100. */
  percent: number;
}

const SENT = new Set(["sent", "answered", "no_answer", "closed"]);

export function isRemoved(l: Pick<RemovalLetter, "removed_at" | "outcome">): boolean {
  return Boolean(l.removed_at) || l.outcome === "deleted";
}

function root(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/** Pura (testeable): cuenta por sitio, no por carta. Un sitio cuenta como retirado solo si todas sus cartas lo estan. */
export function computeRemovalStats(letters: RemovalLetter[], foundHosts: string[], now = new Date()): RemovalStats {
  const bySite = new Map<string, RemovalLetter[]>();
  for (const l of letters) {
    if (!SENT.has(l.status)) continue;
    const k = root(l.host);
    bySite.set(k, [...(bySite.get(k) ?? []), l]);
  }
  const all = new Set<string>([...foundHosts.map(root), ...bySite.keys()]);
  let removed = 0, refused = 0, overdue = 0, pending = 0;
  for (const list of bySite.values()) {
    if (list.every(isRemoved)) removed += 1;
    else if (list.some((l) => l.outcome === "refused")) refused += 1;
    else if (list.some((l) => l.deadline_at && new Date(l.deadline_at) < now)) overdue += 1;
    else pending += 1;
  }
  const found = all.size;
  return { found, requested: bySite.size, removed, pending, overdue, refused, percent: found ? Math.round((removed / found) * 100) : 0 };
}

interface FindingLike { category?: string; source_url?: string | null }

/** Sitios del ultimo informe sobre los que se puede actuar (perfiles y datos publicos con URL). */
export function actionableHosts(findings: FindingLike[] | null | undefined): string[] {
  const out = new Set<string>();
  for (const f of findings ?? []) {
    if (!f.source_url || f.category === "breaches") continue;
    try { out.add(root(new URL(f.source_url).hostname)); } catch { /* URL rara: fuera */ }
  }
  return [...out];
}

/**
 * Decide que guardar tras una comprobacion. Devuelve el parche para la carta y
 * si esta comprobacion es LA que confirma la retirada (para avisar una sola vez).
 */
export function applyCheck(
  letter: { still_listed: boolean | null; removed_at: string | null; check_count?: number | null; events: RemovalEvent[] | null },
  result: CheckResult,
  now = new Date(),
): { patch: Record<string, unknown>; justRemoved: boolean; reappeared: boolean } {
  const at = now.toISOString();
  const patch: Record<string, unknown> = { last_check_at: at, check_count: (letter.check_count ?? 0) + 1 };
  // "No se pudo comprobar" no pisa un resultado anterior valido.
  if (result.listed !== null) patch.still_listed = result.listed;
  const confirmedGone = result.listed === false && (result.httpGone || letter.still_listed === true);
  const justRemoved = confirmedGone && !letter.removed_at;
  const reappeared = result.listed === true && Boolean(letter.removed_at);
  if (justRemoved) {
    patch.removed_at = at;
    patch.events = [...(letter.events ?? []), { at, type: "verified_gone" }];
  } else if (reappeared) {
    patch.removed_at = null;
    patch.events = [...(letter.events ?? []), { at, type: "reappeared" }];
  }
  return { patch, justRemoved, reappeared };
}
