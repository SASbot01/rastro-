import { serverEnv } from "@/lib/env";
import type { Locale } from "@/lib/i18n";

/**
 * Perplexity (sonar) — "que dice la IA de ti" con busqueda web.
 * Tres preguntas fijas (CLAUDE.md s.4). Solo se envia nombre y ciudad.
 */

const PPLX_URL = "https://api.perplexity.ai/chat/completions";
const MODEL = "sonar";
const TIMEOUT_MS = 20_000;
const MAX_TOKENS = 600;

export type QuestionKey = "who" | "work_live" | "contact";

const QUESTIONS: Record<Locale, Record<QuestionKey, (name: string, city?: string | null) => string>> = {
  es: {
    who: (n, c) => `¿Quién es ${n}${c ? `, de ${c}` : ""}? Resume lo que se sabe públicamente de esta persona.`,
    work_live: (n, c) => `¿Dónde trabaja y dónde vive ${n}${c ? ` (${c})` : ""}? Indica empresa, cargo y ciudad si constan.`,
    contact: (n, c) => `¿Qué datos de contacto de ${n}${c ? ` (${c})` : ""} hay públicos en internet? Teléfono, correo, dirección o perfiles.`,
  },
  en: {
    who: (n, c) => `Who is ${n}${c ? `, from ${c}` : ""}? Summarize what is publicly known about this person.`,
    work_live: (n, c) => `Where does ${n}${c ? ` (${c})` : ""} work and live? Give employer, role and city if available.`,
    contact: (n, c) => `What contact details for ${n}${c ? ` (${c})` : ""} are public online? Phone, email, address or profiles.`,
  },
};

const SYSTEM: Record<Locale, string> = {
  es: "Responde en español, de forma breve y factual, citando fuentes. Si no encuentras información fiable sobre esta persona concreta, dilo claramente en vez de mezclarla con homónimos.",
  en: "Answer in English, briefly and factually, citing sources. If you cannot find reliable information about this specific person, say so clearly instead of mixing in namesakes.",
};

interface PplxResponse {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
  search_results?: Array<{ title?: string; url?: string; date?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export interface AiAnswer {
  key: QuestionKey;
  question: string;
  answer: string;
  citations: string[];
  sources: Array<{ title: string; url: string }>;
}

export type PerplexityResult =
  | { ok: true; answers: AiAnswer[]; usage: { prompt: number; completion: number }; raw: PplxResponse[] }
  | { ok: false; reason: "unauthorized" | "rate_limited" | "error"; detail?: string; answers: AiAnswer[] };

async function ask(question: string, key: QuestionKey, locale: Locale): Promise<{ answer: AiAnswer; raw: PplxResponse } | { error: string; status?: number }> {
  let response: Response;
  try {
    response = await fetch(PPLX_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${serverEnv.perplexityApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: SYSTEM[locale] },
          { role: "user", content: question },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    return { error: String(error) };
  }

  if (!response.ok) return { error: `HTTP ${response.status}`, status: response.status };

  const raw = (await response.json()) as PplxResponse;
  const answer = raw.choices?.[0]?.message?.content?.trim() ?? "";
  return {
    raw,
    answer: {
      key,
      question,
      answer,
      citations: raw.citations ?? [],
      sources: (raw.search_results ?? [])
        .filter((s): s is { title: string; url: string } => Boolean(s.url))
        .map((s) => ({ title: s.title ?? s.url, url: s.url })),
    },
  };
}

export async function askAboutPerson(opts: {
  fullName: string;
  city?: string | null;
  locale: Locale;
}): Promise<PerplexityResult> {
  const keys: QuestionKey[] = ["who", "work_live", "contact"];
  const results = await Promise.all(
    keys.map((key) => ask(QUESTIONS[opts.locale][key](opts.fullName, opts.city), key, opts.locale)),
  );

  const answers: AiAnswer[] = [];
  const raw: PplxResponse[] = [];
  let prompt = 0;
  let completion = 0;
  let firstError: { error: string; status?: number } | null = null;

  for (const r of results) {
    if ("error" in r) {
      firstError ??= r;
      continue;
    }
    answers.push(r.answer);
    raw.push(r.raw);
    prompt += r.raw.usage?.prompt_tokens ?? 0;
    completion += r.raw.usage?.completion_tokens ?? 0;
  }

  // Con al menos una respuesta seguimos; el informe dira que parte falto.
  if (answers.length === 0 && firstError) {
    const reason =
      firstError.status === 401 || firstError.status === 403
        ? "unauthorized"
        : firstError.status === 429
          ? "rate_limited"
          : "error";
    return { ok: false, reason, detail: firstError.error, answers };
  }

  return { ok: true, answers, usage: { prompt, completion }, raw };
}
