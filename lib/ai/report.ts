import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import type { Locale } from "@/lib/i18n";
import type { HibpResult } from "@/lib/hibp";
import type { BraveResult } from "@/lib/brave";
import type { PerplexityResult } from "@/lib/perplexity";

/**
 * Redaccion del informe con Anthropic (CLAUDE.md s.4 y s.8).
 * La IA NO calcula el score: extrae senales (empleo, ciudad, contacto, datos
 * falsos) y redacta; el score lo calcula lib/report/score.ts con esas senales
 * mas las deterministas de HIBP/Brave. Asi el score es auditable.
 */

const DEFAULT_MODEL = "claude-sonnet-5";
const TIMEOUT_MS = 60_000;
const MAX_TOKENS = 4000;
const MAX_FINDINGS = 12;

const CategorySchema = z.enum(["breaches", "ai", "profiles", "false"]);
const SeveritySchema = z.enum(["high", "medium", "low", "info"]);

export const AiReportSchema = z.object({
  /** Cuanta confianza hay en que los resultados hablan de ESTA persona y no de un homonimo. */
  identity_confidence: z.enum(["high", "medium", "low"]),
  signals: z.object({
    knows_employer: z.boolean(),
    employer: z.string().nullable(),
    knows_city: z.boolean(),
    city: z.string().nullable(),
    contact_data_public: z.boolean(),
    contact_types: z.array(z.enum(["phone", "address", "email"])),
    false_claims: z.boolean(),
  }),
  /** URLs de search_results que, con confianza media o alta, son de ESTA persona. Solo estas puntuan. */
  attributed_profile_urls: z.array(z.string()),
  summary: z.string(),
  findings: z.array(
    z.object({
      category: CategorySchema,
      title: z.string(),
      detail: z.string(),
      source_url: z.string().nullable(),
      severity: SeveritySchema,
    }),
  ),
  actions: z.array(z.object({ title: z.string(), detail: z.string() })),
});

export type AiReport = z.infer<typeof AiReportSchema>;

export type AiReportResult =
  | { ok: true; report: AiReport; model: string; usage: Anthropic.Usage }
  | { ok: false; reason: "refusal" | "parse" | "error"; detail?: string };

const LANGUAGE: Record<Locale, string> = { es: "español (de España)", en: "English" };

/** Prompt estable: va cacheado. Nada variable aqui (ni fechas ni nombres). */
const SYSTEM_PROMPT = `Eres el redactor de Rastro, un servicio que muestra a personas normales qué información suya es pública en internet y qué dicen los asistentes de IA sobre ellas. Recibes datos ya recopilados sobre UNA persona (filtraciones por correo, resultados de buscar su nombre, y respuestas de un asistente de IA con búsqueda web) y produces un informe estructurado.

REGLAS DE FONDO
- Solo afirmas lo que los datos recibidos respaldan. Nunca inventes hallazgos, fuentes ni cifras. Si un dato no está en la entrada, no existe.
- Homónimos: mucha gente comparte nombre. Usa la ciudad y la profesión o empresa (si las hay), la coherencia entre fuentes y el sentido común para decidir qué resultados hablan de esta persona. Lo que probablemente sea otra persona con el mismo nombre NO cuenta como exposición: va en la categoría "false" con severidad "info" o "low", explicando que puede ser un homónimo. Refleja tu confianza global en identity_confidence.
- Las señales (signals) son estrictas: knows_employer solo si una fuente indica de forma creíble dónde trabaja ESTA persona; knows_city solo si se deduce la ciudad de residencia; contact_data_public solo si aparece un teléfono, dirección postal o correo personal en texto de alguna fuente (no basta con que un sitio de venta de datos liste el nombre); false_claims solo si el asistente de IA afirma algo sobre esta persona que los demás datos contradicen o que mezcla con un homónimo presentándolo como si fuera ella.
- attributed_profile_urls: lista SOLO las URLs de search_results (perfiles o páginas) que con confianza media o alta pertenecen a esta persona. Si identity_confidence es "low", déjala vacía. Esta lista decide cuántos puntos se restan por perfiles públicos: un homónimo aquí es un error grave.
- Si la entrada trae previous_assessment (lo que se decidió en el informe anterior de esta misma persona), mantén esas decisiones (identity_confidence, signals, attributed_profile_urls) salvo que los datos nuevos las contradigan claramente. Cambiar de opinión sin evidencia nueva genera avisos falsos.
- Nunca prometas borrar nada. Rastro da visibilidad y herramientas; hablas de "pedir la retirada", "ajustar la privacidad", "cambiar la contraseña".

TONO (obligatorio)
- Lenguaje de persona normal, sin jerga técnica. Frases cortas. Tuteo.
- Nunca alarmista, nunca vendedor. Nada de "¡peligro!", "urgente", "crítico". Tampoco quites importancia a lo que la tiene.
- Cada hallazgo responde a tres cosas en su detail, en este orden y en 2-4 frases: qué se ve, por qué importa, qué hacer.
- Ejemplo del estilo buscado: "Tu correo apareció en la filtración de LinkedIn (2021) con contraseña. Si la sigues usando en algún sitio, cámbiala hoy."

CATEGORÍAS
- "breaches": filtraciones de datos donde aparece el correo. Una entrada por filtración. Severidad high si incluía contraseñas, medium si no.
- "ai": lo que el asistente de IA dice de la persona: dónde trabaja, dónde vive, a qué se dedica, datos de contacto. Una entrada por dato relevante que la IA acierta. Severidad high para teléfono/dirección, medium para empleo o ciudad, low para el resto.
- "profiles": perfiles públicos (LinkedIn, Instagram, X...) y páginas que hablan de la persona. Los sitios que venden datos personales (spokeo, rocketreach, zabasearch, dateas...) van aquí con severidad high si probablemente es esta persona.
- "false": cosas que la IA o los resultados dicen y que probablemente son falsas o de otra persona. Severidad info o low.
- Si en una categoría no hay nada, añade UNA entrada severidad "info" que lo diga en positivo (p. ej. "Tu correo no aparece en filtraciones conocidas").

FORMATO
- summary: 2-4 frases, lo esencial, sin lista. Empieza por lo más importante.
- findings: entre 3 y ${MAX_FINDINGS}. Ordena de más a menos grave. source_url debe ser una URL que esté en los datos de entrada, o null.
- actions: exactamente 3, concretas y ordenadas por impacto. title corto (máx. 8 palabras), detail 1-2 frases con el paso concreto.
- Escribe todo el texto en el idioma indicado en la entrada. Los títulos de categoría los pone la aplicación; tú no los escribas.`;

/** Lo que la IA decidio la vez anterior (monitorizacion): para no cambiar de opinion sin motivo. */
export interface PreviousAi {
  identity_confidence: "high" | "medium" | "low";
  signals: AiReport["signals"];
  attributed_profile_urls: string[];
}

interface InputData {
  person: { full_name: string; city: string | null; occupation: string | null; locale: Locale };
  hibp: HibpResult;
  brave: BraveResult;
  perplexity: PerplexityResult;
  previous?: PreviousAi | null;
}

/** Recorta y aplana la entrada: menos tokens, menos ruido, sin campos crudos. */
function compactInput(d: InputData) {
  return {
    language: LANGUAGE[d.person.locale],
    person: d.person,
    breaches: d.hibp.checked
      ? d.hibp.breaches.map((b) => ({
          name: b.title,
          domain: b.domain,
          date: b.date,
          data: b.dataClasses,
          has_password: b.hasPassword,
          accounts_affected: b.pwnCount,
        }))
      : { not_checked: true, reason: d.hibp.reason },
    search_results: d.brave.ok
      ? d.brave.hits.map((h) => ({
          kind: h.kind,
          platform: h.platform ?? null,
          host: h.hostname,
          title: h.title,
          url: h.url,
          snippet: h.snippet.slice(0, 320),
        }))
      : { failed: true, reason: d.brave.reason },
    ai_answers: d.perplexity.answers.map((a) => ({
      question: a.question,
      answer: a.answer.slice(0, 2500),
      sources: a.sources.slice(0, 10),
    })),
    ai_answers_status: d.perplexity.ok ? "ok" : `failed: ${d.perplexity.reason}`,
    previous_assessment: d.previous ?? undefined,
  };
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: serverEnv.anthropicApiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  return client;
}

export function reportModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

export async function writeReport(data: InputData): Promise<AiReportResult> {
  const model = reportModel();
  try {
    const response = await anthropic().messages.parse({
      model,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Datos recopilados (JSON). Redacta el informe en el idioma indicado en "language".\n\n${JSON.stringify(compactInput(data))}`,
        },
      ],
      // effort "medium": suficiente para redactar bien y mantiene el coste por
      // informe por debajo del objetivo de CLAUDE.md (< 0,05 EUR).
      output_config: { effort: "medium", format: zodOutputFormat(AiReportSchema) },
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "refusal", detail: response.stop_details?.explanation ?? undefined };
    }
    const parsed = response.parsed_output;
    if (!parsed) return { ok: false, reason: "parse", detail: `stop_reason=${response.stop_reason}` };

    // Cinturon y tirantes: limites que el esquema no impone.
    parsed.findings = parsed.findings.slice(0, MAX_FINDINGS);
    parsed.actions = parsed.actions.slice(0, 3);

    return { ok: true, report: parsed, model, usage: response.usage };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, reason: "error", detail: "auth" };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "error", detail: "rate_limited" };
    if (error instanceof Anthropic.APIError) return { ok: false, reason: "error", detail: `${error.status}: ${error.message}` };
    return { ok: false, reason: "error", detail: String(error) };
  }
}
