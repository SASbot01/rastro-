import { supabaseAdmin } from "@/lib/supabase";
import { askAboutPerson, type PerplexityResult } from "@/lib/perplexity";
import { askAssistants, type AssistantAnswer } from "@/lib/assistants";
import { extractFacts, type AnswerForFacts } from "@/lib/ai/facts";
import { diffFacts, type AiChange, type FactsByProvider, type WatchProvider } from "@/lib/ai-watch-core";
import type { Locale } from "@/lib/i18n";

export * from "@/lib/ai-watch-core";

/**
 * Memoria de lo que dice cada IA (tabla ai_snapshots). Una foto por informe
 * de una cuenta y, para Pro con vigilancia, una foto semanal ligera (solo las
 * preguntas a las IA, sin HIBP ni buscador). Cada foto guarda la respuesta
 * literal, la ficha de hechos y los cambios frente a la foto anterior.
 */

export interface StoredAnswer { provider: WatchProvider; model: string | null; question: string; answer: string; sources: Array<{ title: string; url: string }> }

export interface Snapshot {
  id: string;
  request_id: string | null;
  source: "report" | "watch";
  answers: StoredAnswer[];
  facts: FactsByProvider;
  changes: AiChange[];
  taken_at: string;
}

interface Person { full_name: string; city: string | null; occupation: string | null }

/** Respuestas tal y como las guarda el informe -> formato de la memoria. */
export function answersFromRaw(perplexity: PerplexityResult | { answers?: PerplexityResult["answers"] } | null | undefined, assistants: AssistantAnswer[] | null | undefined): StoredAnswer[] {
  const out: StoredAnswer[] = [];
  for (const a of perplexity?.answers ?? []) {
    if (a.answer) out.push({ provider: "perplexity", model: null, question: a.question, answer: a.answer, sources: (a.sources ?? []).slice(0, 8) });
  }
  for (const a of assistants ?? []) out.push({ provider: a.provider, model: a.model, question: a.question, answer: a.answer, sources: a.sources ?? [] });
  return out;
}

function forFacts(answers: StoredAnswer[]): AnswerForFacts[] {
  const by = new Map<WatchProvider, string[]>();
  for (const a of answers) by.set(a.provider, [...(by.get(a.provider) ?? []), a.answer]);
  return [...by.entries()].map(([provider, texts]) => ({ provider, text: texts.join("\n\n") }));
}

export async function lastSnapshot(userId: string, before?: string): Promise<Snapshot | null> {
  let q = supabaseAdmin().from("ai_snapshots").select("id, request_id, source, answers, facts, changes, taken_at").eq("user_id", userId);
  if (before) q = q.lt("taken_at", before);
  const { data } = await q.order("taken_at", { ascending: false }).limit(1).maybeSingle<Snapshot>();
  return data ?? null;
}

/** Guarda una foto (con ficha y cambios). Devuelve null si no hay respuestas o la ficha fallo. */
export async function saveSnapshot(opts: { userId: string; requestId?: string | null; source: "report" | "watch"; person: Person; locale: Locale; answers: StoredAnswer[]; takenAt?: string }): Promise<Snapshot | null> {
  if (opts.answers.length === 0) return null;
  const facts = await extractFacts({ person: opts.person, locale: opts.locale, answers: forFacts(opts.answers) });
  if (!facts || Object.keys(facts).length === 0) return null;
  const prev = await lastSnapshot(opts.userId, opts.takenAt);
  const changes = diffFacts(prev?.facts, facts);
  const { data, error } = await supabaseAdmin()
    .from("ai_snapshots")
    .insert({ user_id: opts.userId, request_id: opts.requestId ?? null, source: opts.source, answers: opts.answers, facts, changes, ...(opts.takenAt ? { taken_at: opts.takenAt } : {}) })
    .select("id, request_id, source, answers, facts, changes, taken_at")
    .single<Snapshot>();
  if (error) {
    console.warn("[ai-watch] no se pudo guardar la foto:", error.message);
    return null;
  }
  return data;
}

/** Foto ligera: pregunta a las IA ahora mismo (sin informe completo). */
export async function takeWatchSnapshot(userId: string, person: Person, locale: Locale): Promise<Snapshot | null> {
  const [perplexity, assistants] = await Promise.all([
    askAboutPerson({ fullName: person.full_name, city: person.city, occupation: person.occupation, locale }),
    askAssistants({ fullName: person.full_name, city: person.city, occupation: person.occupation, locale }),
  ]);
  return saveSnapshot({ userId, source: "watch", person, locale, answers: answersFromRaw(perplexity, assistants.answers) });
}

interface ReportForBackfill {
  request_id: string;
  created_at: string;
  raw: { perplexity?: PerplexityResult; assistants?: { answers?: AssistantAnswer[] }; cached_from?: string } | null;
  requests: { full_name: string; city: string | null; occupation: string | null; locale: string; user_id: string } | Array<{ full_name: string; city: string | null; occupation: string | null; locale: string; user_id: string }>;
}

/**
 * Informes de la cuenta que aun no tienen foto (p. ej. hechos antes de crear
 * la cuenta o antes de existir esta funcion). Se rellenan del mas antiguo al
 * mas nuevo para que los cambios salgan en orden. Maximo `limit` por llamada.
 */
export async function backfillSnapshots(userId: string, limit = 4): Promise<number> {
  const supabase = supabaseAdmin();
  const [{ data: reports }, { data: have }] = await Promise.all([
    supabase.from("reports").select("request_id, created_at, raw, requests!inner(full_name, city, occupation, locale, user_id)").eq("requests.user_id", userId).order("created_at", { ascending: false }).limit(8).returns<ReportForBackfill[]>(),
    supabase.from("ai_snapshots").select("request_id").eq("user_id", userId).not("request_id", "is", null).returns<Array<{ request_id: string }>>(),
  ]);
  const done = new Set((have ?? []).map((h) => h.request_id));
  // Un informe copiado de la cache lleva las MISMAS respuestas que su original: otra foto solo meteria ruido en la cronologia.
  const todo = (reports ?? []).filter((r) => !done.has(r.request_id) && !r.raw?.cached_from && answersFromRaw(r.raw?.perplexity, r.raw?.assistants?.answers).length > 0).slice(0, limit).reverse();
  let n = 0;
  for (const r of todo) {
    const req = Array.isArray(r.requests) ? r.requests[0] : r.requests;
    const snap = await saveSnapshot({
      userId, requestId: r.request_id, source: "report", takenAt: r.created_at,
      person: { full_name: req.full_name, city: req.city, occupation: req.occupation },
      locale: req.locale === "en" ? "en" : "es",
      answers: answersFromRaw(r.raw?.perplexity, r.raw?.assistants?.answers),
    });
    if (snap) n += 1;
  }
  return n;
}
