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

/** Quita acentos y pasa a minusculas para comparar nombres con el texto de una pagina. */
function foldPage(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Paginas que no son la ficha: muro anti-bots, "activa JavaScript", acceso denegado, limite de peticiones, pide iniciar sesion. */
const BLOCK_PAGE = /captcha|verify (that )?you are (a )?human|are you a robot|no eres un robot|no soy un robot|checking your browser|just a moment|access denied|acceso denegado|request blocked|unusual traffic|trafico inusual|too many requests|demasiadas (peticiones|solicitudes)|(enable|activ[ae]r?|habilit[ae]r?|requires?|necesitas?) (el )?javascript|javascript (is|esta) (disabled|desactivado)|(log|sign) in to (continue|view)|inicia sesion para (continuar|ver)/;

/**
 * ¿Sale el nombre en esta pagina (HTML ya descargado con 200 OK)?
 * true = sigue apareciendo; false = la pagina se lee bien y el nombre no esta;
 * null = no se puede saber. Un muro anti-bots o un "inicia sesion" responden 200
 * sin el nombre: darlo por "ya no aparece" seria cantar una retirada en falso.
 */
export function pageListsName(html: string, fullName: string): boolean | null {
  const parts = foldPage(fullName).split(/\s+/).filter((p) => p.length > 2);
  if (parts.length === 0) return null;
  const text = foldPage(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  if (text.length < 200) return null;
  // Apellidos + nombre: todos los trozos del nombre deben aparecer.
  if (parts.every((p) => text.includes(p))) return true;
  return BLOCK_PAGE.test(text) ? null : false;
}

/**
 * Solo se descargan paginas publicas de internet. La URL de una carta puede
 * escribirla la persona (cartas de imagen), y el servidor no debe ir a buscar
 * por ella direcciones internas (localhost, red privada, Tailscale, metadatos de nube).
 */
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.startsWith("[")) return false; // IPv6 literal: ninguna ficha publica vive ahi
  if (host === "localhost" || !host.includes(".") || /\.(local|localhost|internal|lan|home|intranet|corp)$/.test(host)) return false;
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT / Tailscale
  }
  return true;
}

/**
 * Decide que guardar tras una comprobacion. Devuelve el parche para la carta,
 * si esta comprobacion es LA que confirma la retirada y si toca avisar (solo la
 * primera vez: una pagina que va y viene no debe mandar un correo cada semana).
 */
export function applyCheck(
  letter: { still_listed: boolean | null; removed_at: string | null; check_count?: number | null; events: RemovalEvent[] | null },
  result: CheckResult,
  now = new Date(),
): { patch: Record<string, unknown>; justRemoved: boolean; reappeared: boolean; notify: boolean } {
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
  const notify = justRemoved && !(letter.events ?? []).some((e) => e.type === "verified_gone");
  return { patch, justRemoved, reappeared, notify };
}
