import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, parseJsonLoose, responseText } from "@/lib/ai/client";
import type { Locale } from "@/lib/i18n";

/**
 * v3 — Guardian: "¿es una estafa?". La persona pega un SMS, correo o WhatsApp
 * y la IA lo analiza con el contexto de su propio informe (que cuentas tiene,
 * que se ha filtrado, ciudad, empleo) para decir si es una estafa dirigida y
 * que datos suyos usa. No guardamos el mensaje.
 */

export const GuardianSchema = z.object({
  verdict: z.enum(["scam", "suspicious", "legit"]),
  confidence: z.number().min(0).max(100),
  headline: z.string(),
  reasons: z.array(z.string()).min(1),
  /** Datos de la persona que el mensaje aprovecha (solo si hay contexto). */
  uses_your_data: z.array(z.string()),
  actions: z.array(z.string()).min(1),
  /** Si parece legitimo, como verificarlo por otro canal. */
  verify_how: z.string().nullable(),
});
export type GuardianVerdict = z.infer<typeof GuardianSchema>;

const MODEL = process.env.ANTHROPIC_GUARDIAN_MODEL || "claude-haiku-4-5-20251001";

const SYSTEM = `Eres el guardián de Rastro. Una persona te pega un mensaje que ha recibido (SMS, correo, WhatsApp, llamada transcrita) y quiere saber si es una estafa. Analízalo como un experto en fraude al consumidor en España.

Criterios: urgencia artificial, enlaces acortados o dominios que imitan marcas, petición de códigos/contraseñas/pagos, remitente que no cuadra, errores sutiles, premios o multas inesperadas, "problemas con tu cuenta/pedido/envío", suplantación de bancos, Correos, DGT, Hacienda, Seguridad Social, BOE, hijos "con móvil nuevo".
Si recibes context (cuentas que la persona tiene, filtraciones, ciudad, empleo), úsalo: un mensaje "de Amazon" es más creíble si tiene cuenta en Amazon, y una estafa que cita su empleo es una estafa dirigida. Enumera en uses_your_data qué datos suyos aprovecha.
verdict: scam (claramente estafa), suspicious (no se puede confirmar; tratar como estafa hasta verificar), legit (parece legítimo; aun así explica cómo verificarlo por un canal oficial).
Nunca digas que algo es seguro con certeza. No pidas ni repitas datos sensibles. Acciones concretas: no pulsar, verificar por la app oficial, bloquear, denunciar en 017/INCIBE o Policía, cambiar contraseña si ya se pulsó.
Responde en el idioma indicado. Texto plano, frases cortas.`;

export async function analyzeMessage(input: { locale: Locale; text: string; sender: string | null; context: { accounts: string[]; breaches: string[]; city: string | null; occupation: string | null } | null }): Promise<{ ok: true; verdict: GuardianVerdict } | { ok: false; detail: string }> {
  try {
    const response = await anthropic(45_000).messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify({ language: input.locale === "es" ? "español" : "English", sender: input.sender, message: input.text.slice(0, 4000), context: input.context }) }],
      output_config: { format: zodOutputFormat(GuardianSchema) },
    });
    if (response.stop_reason === "refusal") return { ok: false, detail: "refusal" };
    const text = responseText(response);
    const parsed = GuardianSchema.safeParse(parseJsonLoose(text));
    if (!parsed.success) {
      console.warn("[ai] salida no valida:", parsed.error.issues.slice(0, 3).map((i) => i.path.join(".") + ": " + i.message).join("; "), "|", text.slice(0, 200));
      return { ok: false, detail: "parse" };
    }
    const v = parsed.data;
    // Los limites de tamano se aplican aqui (los modelos pequenos no siempre los respetan).
    return { ok: true, verdict: { ...v, confidence: Math.round(v.confidence), reasons: v.reasons.slice(0, 6), uses_your_data: v.uses_your_data.slice(0, 5), actions: v.actions.slice(0, 4) } };
  } catch (e) {
    return { ok: false, detail: String(e).slice(0, 200) };
  }
}
