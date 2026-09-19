// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Memoria de lo que cada IA dice de una persona y comparacion entre dos fotos.
 * La comparacion es determinista sobre una ficha de hechos (empleo, ciudad,
 * contacto...), no sobre el texto literal, que cambia en cada respuesta.
 */

export type WatchProvider = "perplexity" | "openai" | "gemini";
export type ContactKind = "phone" | "email" | "address" | "social";

export interface AiFacts {
  /** La IA identifica a ESTA persona (no "no encuentro nada" ni solo homonimos). */
  knows_you: boolean;
  employer: string | null;
  role: string | null;
  city: string | null;
  contact: ContactKind[];
  /** Otras afirmaciones concretas sobre la persona (frases cortas). */
  claims: string[];
  /** Mezcla datos de otras personas con el mismo nombre. */
  mixes_people: boolean;
}
export type FactsByProvider = Partial<Record<WatchProvider, AiFacts>>;

export type ChangeKind =
  | "learned_you" | "forgot_you"
  | "employer_new" | "employer_changed" | "employer_gone"
  | "city_new" | "city_changed" | "city_gone"
  | "contact_new" | "contact_gone"
  | "mixes_on" | "mixes_off"
  | "claim_new";

export interface AiChange {
  provider: WatchProvider;
  kind: ChangeKind;
  before: string | null;
  after: string | null;
  /** Los cambios menores se enseñan en la cronologia pero no disparan un aviso. */
  minor: boolean;
  /** true = mas expuesto que antes; false = menos. */
  worse: boolean;
}

export const EMPTY_FACTS: AiFacts = { knows_you: false, employer: null, role: null, city: null, contact: [], claims: [], mixes_people: false };

export function fold(text: string | null | undefined): string {
  return (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Mismo dato aunque cambie la redaccion ("Hospital La Fe" vs "el Hospital Universitario La Fe"). */
export function sameFact(a: string | null, b: string | null): boolean {
  const x = fold(a), y = fold(b);
  if (!x || !y) return x === y;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  return similarity(x, y) >= 0.75;
}

function similarity(x: string, y: string): number {
  const stop = new Set(["el", "la", "los", "las", "de", "del", "en", "y", "the", "of", "at", "in", "and", "a", "un", "una"]);
  const A = new Set(x.split(" ").filter((w) => w.length > 1 && !stop.has(w)));
  const B = new Set(y.split(" ").filter((w) => w.length > 1 && !stop.has(w)));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  // Coeficiente de solapamiento: cuanto de la version corta esta dentro de la larga.
  return inter / Math.min(A.size, B.size);
}

function fieldChange(provider: WatchProvider, field: "employer" | "city", before: string | null, after: string | null): AiChange | null {
  if (sameFact(before, after)) return null;
  if (!before && after) return { provider, kind: `${field}_new`, before: null, after, minor: false, worse: true };
  if (before && !after) return { provider, kind: `${field}_gone`, before, after: null, minor: false, worse: false };
  return { provider, kind: `${field}_changed`, before, after, minor: false, worse: true };
}

/** Cambios de una IA entre dos fotos. Si antes no habia foto de esa IA, no hay con que comparar. */
export function diffProvider(provider: WatchProvider, prev: AiFacts | undefined, next: AiFacts | undefined): AiChange[] {
  if (!prev || !next) return [];
  const out: AiChange[] = [];
  if (!prev.knows_you && next.knows_you) out.push({ provider, kind: "learned_you", before: null, after: null, minor: false, worse: true });
  if (prev.knows_you && !next.knows_you) out.push({ provider, kind: "forgot_you", before: null, after: null, minor: false, worse: false });
  for (const f of ["employer", "city"] as const) {
    const c = fieldChange(provider, f, prev[f], next[f]);
    if (c) out.push(c);
  }
  for (const k of next.contact) if (!prev.contact.includes(k)) out.push({ provider, kind: "contact_new", before: null, after: k, minor: false, worse: true });
  for (const k of prev.contact) if (!next.contact.includes(k)) out.push({ provider, kind: "contact_gone", before: k, after: null, minor: false, worse: false });
  if (!prev.mixes_people && next.mixes_people) out.push({ provider, kind: "mixes_on", before: null, after: null, minor: false, worse: true });
  if (prev.mixes_people && !next.mixes_people) out.push({ provider, kind: "mixes_off", before: null, after: null, minor: true, worse: false });
  // Afirmaciones nuevas: ruidosas por naturaleza -> siempre menores, maximo 3.
  const fresh = next.claims.filter((c) => !prev.claims.some((p) => sameFact(p, c)) && !sameFact(c, next.employer) && !sameFact(c, next.city));
  for (const c of fresh.slice(0, 3)) out.push({ provider, kind: "claim_new", before: null, after: c, minor: true, worse: true });
  return out;
}

export function diffFacts(prev: FactsByProvider | null | undefined, next: FactsByProvider): AiChange[] {
  if (!prev) return [];
  return (Object.keys(next) as WatchProvider[]).flatMap((p) => diffProvider(p, prev[p], next[p]));
}

/** ¿Merece un aviso? Solo si hay algun cambio que no sea menor. */
export function worthAlert(changes: AiChange[]): boolean {
  return changes.some((c) => !c.minor);
}

/** Cuanto sabe una IA de ti, 0-100 (para la barra de cada asistente). */
export function knowledgeLevel(f: AiFacts | undefined): number {
  if (!f || !f.knows_you) return 0;
  return Math.min(100, 25 + (f.employer ? 20 : 0) + (f.city ? 15 : 0) + f.contact.length * 12 + Math.min(3, f.claims.length) * 4);
}
