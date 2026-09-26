import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, parseJsonLoose, responseText } from "@/lib/ai/client";
import { EMPTY_FACTS, type AiFacts, type FactsByProvider, type WatchProvider } from "@/lib/ai-watch-core";
import type { Locale } from "@/lib/i18n";

/**
 * Convierte la respuesta literal de cada IA en una ficha de hechos comparable
 * en el tiempo. Un modelo pequeño (Haiku) lee las respuestas y rellena la
 * ficha; la comparacion posterior es determinista (lib/ai-watch-core.ts).
 */

const MODEL = process.env.ANTHROPIC_FACTS_MODEL || "claude-haiku-4-5-20251001";

const Facts = z.object({
  knows_you: z.boolean(),
  employer: z.string().nullable(),
  role: z.string().nullable(),
  city: z.string().nullable(),
  contact: z.array(z.enum(["phone", "email", "address", "social"])),
  claims: z.array(z.string()),
  mixes_people: z.boolean(),
});
const Schema = z.object({ providers: z.array(z.object({ provider: z.enum(["perplexity", "openai", "gemini"]), facts: Facts })) });

const SYSTEM = `Eres un extractor de hechos. Recibes los datos de una persona (name, city, occupation) y las respuestas literales que distintos asistentes de IA han dado al preguntarles por ella. Para CADA asistente rellena una ficha SOLO con lo que ESE asistente afirma sobre ESA persona.

- knows_you: true solo si el asistente identifica a esta persona concreta (coincide con su ciudad u ocupación, o da datos claramente suyos). Si dice que no encuentra información, o solo habla de otras personas con el mismo nombre, false.
- employer: empresa u organización donde dice que trabaja (nombre corto, sin artículos). null si no lo dice.
- role: puesto o profesión que le atribuye. null si no lo dice.
- city: ciudad donde dice que vive o trabaja. null si no lo dice. No copies la ciudad de la pregunta si el asistente no la afirma.
- contact: tipos de dato de contacto que el asistente REVELA o dice dónde encontrar: phone, email, address (dirección postal), social (perfiles en redes con enlace o usuario).
- claims: hasta 5 afirmaciones concretas más sobre la persona (estudios, premios, publicaciones, familia, edad...). Frases cortas, en el idioma indicado. Nada genérico.
- mixes_people: true si mezcla en la misma descripción datos de personas distintas con ese nombre.

Si knows_you es false, deja employer, role, city en null y contact y claims vacíos. No inventes ni deduzcas: si no está en la respuesta, no va en la ficha.`;

export interface AnswerForFacts { provider: WatchProvider; text: string }

export async function extractFacts(input: { person: { full_name: string; city: string | null; occupation: string | null }; locale: Locale; answers: AnswerForFacts[] }): Promise<FactsByProvider | null> {
  if (input.answers.length === 0) return {};
  try {
    const response = await anthropic(45_000).messages.create({
      model: MODEL,
      max_tokens: 1800,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify({ language: input.locale === "es" ? "español" : "English", person: input.person, assistants: input.answers.map((a) => ({ provider: a.provider, answer: a.text.slice(0, 6000) })) }) }],
      output_config: { format: zodOutputFormat(Schema) },
    });
    if (response.stop_reason === "refusal") return null;
    const parsed = Schema.safeParse(parseJsonLoose(responseText(response)));
    if (!parsed.success) {
      console.warn("[ai/facts] salida no valida:", parsed.error.issues.slice(0, 2).map((i) => i.path.join(".") + ": " + i.message).join("; "));
      return null;
    }
    const out: FactsByProvider = {};
    for (const p of parsed.data.providers) {
      if (!input.answers.some((a) => a.provider === p.provider)) continue;
      const f = p.facts;
      const clean = (s: string | null) => (s && s.trim() ? s.trim().slice(0, 120) : null);
      const facts: AiFacts = f.knows_you
        ? { knows_you: true, employer: clean(f.employer), role: clean(f.role), city: clean(f.city), contact: [...new Set(f.contact)], claims: f.claims.map((c) => c.trim().slice(0, 160)).filter(Boolean).slice(0, 5), mixes_people: f.mixes_people }
        : { ...EMPTY_FACTS, mixes_people: f.mixes_people };
      out[p.provider] = facts;
    }
    return out;
  } catch (e) {
    console.warn("[ai/facts] fallo:", String(e).slice(0, 200));
    return null;
  }
}
