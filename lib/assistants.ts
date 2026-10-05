import type { Locale } from "@/lib/i18n";

/**
 * Otros asistentes de IA con busqueda web (ademas de Perplexity): OpenAI y
 * Gemini. Cada uno recibe UNA pregunta ("quien es X") para controlar coste.
 * Son opcionales: sin clave, se omiten y el informe lo dice. Nunca se envia
 * mas que nombre, ciudad y profesion (CLAUDE.md s.9).
 */

export type AssistantProvider = "openai" | "gemini";

export interface AssistantAnswer {
  provider: AssistantProvider;
  model: string;
  question: string;
  answer: string;
  sources: Array<{ title: string; url: string }>;
}

export interface AssistantsResult {
  answers: AssistantAnswer[];
  /** Proveedores configurados que fallaron (para el informe: "no se pudo consultar X"). */
  failed: Array<{ provider: AssistantProvider; detail: string }>;
  /** Proveedores sin clave (no se consultaron). */
  skipped: AssistantProvider[];
}

const TIMEOUT_MS = 40_000;
const MAX_ANSWER = 2500;

function question(locale: Locale, fullName: string, city?: string | null, occupation?: string | null): string {
  const hint = [city, occupation].filter(Boolean).join(", ");
  return locale === "es"
    ? `¿Quién es ${fullName}${hint ? ` (${hint})` : ""}? Dime qué se sabe públicamente de esta persona: a qué se dedica, dónde trabaja, dónde vive y qué datos de contacto o perfiles públicos aparecen. Si hay varias personas con ese nombre, dilo y sepáralas. Responde en español, en menos de 200 palabras, citando fuentes.`
    : `Who is ${fullName}${hint ? ` (${hint})` : ""}? Tell me what is publicly known about this person: occupation, employer, city of residence and any public contact details or profiles. If several people share the name, say so and keep them apart. Answer in English, under 200 words, citing sources.`;
}

async function askOpenAI(q: string): Promise<AssistantAnswer> {
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model, tools: [{ type: "web_search" }], input: q, max_output_tokens: 700 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    output?: Array<{ type: string; content?: Array<{ type: string; text?: string; annotations?: Array<{ type: string; url?: string; title?: string }> }> }>;
  };
  let answer = "";
  const sources: AssistantAnswer["sources"] = [];
  for (const item of data.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type === "output_text" && c.text) answer += c.text;
      for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url) sources.push({ title: a.title ?? a.url, url: a.url });
    }
  }
  if (!answer.trim()) throw new Error("openai: respuesta vacia");
  return { provider: "openai", model, question: q, answer: answer.trim().slice(0, MAX_ANSWER), sources: dedupe(sources) };
}

async function askGemini(q: string): Promise<AssistantAnswer> {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: q }] }], tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 700 } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }>;
  };
  const cand = data.candidates?.[0];
  const answer = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!answer) throw new Error("gemini: respuesta vacia");
  const sources = (cand?.groundingMetadata?.groundingChunks ?? []).flatMap((c) => (c.web?.uri ? [{ title: c.web.title ?? c.web.uri, url: c.web.uri }] : []));
  return { provider: "gemini", model, question: q, answer: answer.slice(0, MAX_ANSWER), sources: dedupe(sources) };
}

function dedupe(list: AssistantAnswer["sources"]): AssistantAnswer["sources"] {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, 8);
}

export function assistantsConfigured(): AssistantProvider[] {
  const out: AssistantProvider[] = [];
  if (process.env.OPENAI_API_KEY) out.push("openai");
  if (process.env.GEMINI_API_KEY) out.push("gemini");
  return out;
}

/** Pregunta a los asistentes configurados en paralelo. Nunca lanza: los fallos van en `failed`. */
export async function askAssistants(opts: { fullName: string; city?: string | null; occupation?: string | null; locale: Locale }): Promise<AssistantsResult> {
  const q = question(opts.locale, opts.fullName, opts.city, opts.occupation);
  const configured = assistantsConfigured();
  const skipped = (["openai", "gemini"] as AssistantProvider[]).filter((p) => !configured.includes(p));
  const results = await Promise.allSettled(configured.map((p) => (p === "openai" ? askOpenAI(q) : askGemini(q))));
  const answers: AssistantAnswer[] = [];
  const failed: AssistantsResult["failed"] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") answers.push(r.value);
    else {
      failed.push({ provider: configured[i], detail: String(r.reason).slice(0, 200) });
      console.warn(`[assistants] ${configured[i]} fallo:`, String(r.reason).slice(0, 200));
    }
  });
  return { answers, failed, skipped };
}

/** Donde pedir rectificacion o supresion a cada proveedor de IA. */
export const AI_RECTIFY: Record<"perplexity" | AssistantProvider, { name: string; url: string }> = {
  perplexity: { name: "Perplexity", url: "mailto:support@perplexity.ai" },
  openai: { name: "ChatGPT (OpenAI)", url: "https://privacy.openai.com/" },
  gemini: { name: "Gemini (Google)", url: "https://support.google.com/legal/troubleshooter/1114905" },
};
