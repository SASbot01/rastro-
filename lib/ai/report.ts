import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropic, reportModel } from "@/lib/ai/client";
export { reportModel };
import type { Locale } from "@/lib/i18n";
import type { HibpResult } from "@/lib/hibp";
import type { BraveResult } from "@/lib/brave";
import type { PerplexityResult } from "@/lib/perplexity";
import type { AssistantAnswer } from "@/lib/assistants";
import type { PastesResult } from "@/lib/hibp";
import type { GravatarResult } from "@/lib/gravatar";
import type { KnownAccount } from "@/lib/report/accounts";

/**
 * Redaccion del informe con Anthropic (CLAUDE.md s.4 y s.8).
 * La IA NO calcula el score: extrae senales (empleo, ciudad, contacto, datos
 * falsos) y redacta; el score lo calcula lib/report/score.ts con esas senales
 * mas las deterministas de HIBP/Brave. Asi el score es auditable.
 */

const TIMEOUT_MS = 60_000;
const MAX_TOKENS = 8000;
const MAX_TOKENS_RETRY = 14000;
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
- other_assistants trae lo que responden otros asistentes de IA (ChatGPT, Gemini) a "quién es esta persona". Trátalos igual que ai_answers: sirven para las señales (empleo, ciudad, contacto), para detectar datos falsos y para los hallazgos de la categoría "ai". Cuando un hallazgo venga de un asistente concreto, nómbralo en el título o el detalle ("ChatGPT afirma que...").
- Sin repeticiones: un solo hallazgo por perfil o URL. Si el mismo perfil o sitio aparece varias veces en search_results, únelo en una entrada.
- Si la persona dio ciudad y/o profesión, un perfil o página que no muestre ninguna señal compatible con ellas (misma ciudad o región, misma profesión o sector, contexto coherente) NO se le atribuye, aunque el nombre coincida exactamente. En ese caso va como posible homónimo.
- Si la entrada trae previous_assessment (lo que se decidió en el informe anterior de esta misma persona), mantén esas decisiones (identity_confidence, signals, attributed_profile_urls) salvo que los datos nuevos las contradigan claramente. Cambiar de opinión sin evidencia nueva genera avisos falsos.
- Nunca prometas borrar nada. Rastro da visibilidad y herramientas; hablas de "pedir la retirada", "ajustar la privacidad", "cambiar la contraseña".

TONO (obligatorio)
- Lenguaje de persona normal, sin jerga técnica. Frases cortas. Tuteo.
- Nunca alarmista, nunca vendedor. Nada de "¡peligro!", "urgente", "crítico". Tampoco quites importancia a lo que la tiene.
- Cada hallazgo responde a tres cosas en su detail, en este orden y en 2-4 frases: qué se ve, por qué importa, qué hacer.
- Ejemplo del estilo buscado: "Tu correo apareció en la filtración de LinkedIn (2021) con contraseña. Si la sigues usando en algún sitio, cámbiala hoy."

CATEGORÍAS
- "breaches": filtraciones de datos donde aparece el correo. Una entrada por filtración. Severidad high si incluía contraseñas, medium si no. Los "pastes" (volcados públicos con el correo) van aquí también, severidad medium, explicando que el correo circula en listas públicas.
- known_accounts es la lista de servicios donde consta que el correo ha tenido cuenta (por las filtraciones) o que la persona enlazó en Gravatar: la aplicación la muestra aparte; no la repitas como hallazgos, pero úsala en el resumen si aporta ("tu correo ha tenido cuenta en al menos N servicios").
- gravatar_profile, si existe, es un perfil público ligado al correo (nombre, foto, ubicación, enlaces): va en "profiles" con severidad medium (o high si expone ubicación o teléfono), y cuenta como perfil atribuido con confianza alta, porque está ligado al correo y no al nombre.
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

export interface InputData {
  person: { full_name: string; city: string | null; occupation: string | null; locale: Locale };
  hibp: HibpResult;
  brave: BraveResult;
  perplexity: PerplexityResult;
  /** Respuestas de otros asistentes (OpenAI, Gemini) a "quien es X", si estan configurados. */
  assistants?: AssistantAnswer[];
  pastes?: PastesResult;
  gravatar?: GravatarResult;
  accounts?: KnownAccount[];
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
    other_assistants: (d.assistants ?? []).map((a) => ({ provider: a.provider, answer: a.answer.slice(0, 1500), sources: a.sources.slice(0, 5).map((s) => s.url) })),
    pastes: d.pastes?.checked ? d.pastes.pastes.map((p) => ({ source: p.source, title: p.title, date: p.date, emails_in_dump: p.emailCount })) : undefined,
    gravatar_profile: d.gravatar?.checked && d.gravatar.profile
      ? { name: d.gravatar.profile.displayName, about: d.gravatar.profile.aboutMe, location: d.gravatar.profile.location, url: d.gravatar.profile.profileUrl, links: d.gravatar.profile.urls, accounts: d.gravatar.profile.accounts }
      : null,
    known_accounts: d.accounts,
    previous_assessment: d.previous ?? undefined,
  };
}

export async function writeReport(data: InputData): Promise<AiReportResult> {
  const first = await writeReportOnce(data, MAX_TOKENS);
  if (first.ok || first.reason === "refusal") return first;
  // Salida cortada o mal formada, o error transitorio: segundo intento con mas espacio.
  console.warn(`[ai] intento 1 fallo (${first.reason} ${first.detail ?? ""}); reintento`);
  const second = await writeReportOnce(data, MAX_TOKENS_RETRY);
  if (second.ok || second.reason === "refusal") return second;
  // Tercer y ultimo intento tras una pausa: un informe de plantilla es el ultimo recurso.
  console.warn(`[ai] intento 2 fallo (${second.reason} ${second.detail ?? ""}); ultimo intento`);
  await new Promise((r) => setTimeout(r, 2500));
  return writeReportOnce(data, MAX_TOKENS_RETRY);
}

/** Escapa saltos de linea, tabuladores y otros caracteres de control que aparezcan crudos dentro de cadenas JSON. */
function repairJson(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        out += ch;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        out += ch;
        continue;
      }
      if (ch === '"') inString = false;
      else if (ch === "\n") { out += "\\n"; continue; }
      else if (ch === "\r") { out += "\\r"; continue; }
      else if (ch === "\t") { out += "\\t"; continue; }
      else if (ch.charCodeAt(0) < 0x20) { continue; }
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    out += ch;
  }
  return out;
}

function parseReport(text: string): AiReport | null {
  const candidates = [text, repairJson(text)];
  // Si sobra texto alrededor del objeto, quedarse con el primer { ... } equilibrado.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start > 0 || end < text.length - 1) candidates.push(repairJson(text.slice(start, end + 1)));
  for (const c of candidates) {
    try {
      const parsed = AiReportSchema.safeParse(JSON.parse(c));
      if (parsed.success) return parsed.data;
    } catch {
      /* siguiente candidato */
    }
  }
  return null;
}

/** Une hallazgos repetidos (misma URL o mismo titulo) conservando el de mayor severidad. */
function dedupeFindings(findings: AiReport["findings"]): AiReport["findings"] {
  const rank = { high: 0, medium: 1, low: 2, info: 3 } as const;
  const seen = new Map<string, number>();
  const out: AiReport["findings"] = [];
  for (const f of findings) {
    const url = f.source_url ? f.source_url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "") : null;
    const key = url ? `u:${url}` : `t:${f.category}:${f.title.trim().toLowerCase()}`;
    const idx = seen.get(key);
    if (idx === undefined) {
      seen.set(key, out.length);
      out.push(f);
    } else if (rank[f.severity] < rank[out[idx].severity]) {
      out[idx] = f;
    }
  }
  return out;
}

async function writeReportOnce(data: InputData, maxTokens: number): Promise<AiReportResult> {
  const model = reportModel();
  try {
    const response = await anthropic(TIMEOUT_MS).messages.create({
      model,
      max_tokens: maxTokens,
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
    if (response.stop_reason === "max_tokens") return { ok: false, reason: "parse", detail: "stop_reason=max_tokens" };

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    // El parseo es propio (no messages.parse): asi un caracter de control suelto no tira el informe entero.
    const parsed = parseReport(text);
    if (!parsed) return { ok: false, reason: "parse", detail: `json invalido (${text.length} chars)` };

    // Cinturon y tirantes: limites que el esquema no impone.
    parsed.findings = dedupeFindings(parsed.findings).slice(0, MAX_FINDINGS);
    parsed.actions = parsed.actions.slice(0, 3);

    return { ok: true, report: parsed, model, usage: response.usage };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, reason: "error", detail: "auth" };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "error", detail: "rate_limited" };
    if (error instanceof Anthropic.APIError) return { ok: false, reason: "error", detail: `${error.status}: ${error.message}` };
    return { ok: false, reason: "error", detail: String(error) };
  }
}
