import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

/** Cliente Anthropic compartido por informe, simulador y guardian. */
let client: Anthropic | null = null;
export function anthropic(timeoutMs = 60_000): Anthropic {
  if (!client) client = new Anthropic({ apiKey: serverEnv.anthropicApiKey, timeout: timeoutMs, maxRetries: 1 });
  return client;
}

export const DEFAULT_MODEL = "claude-sonnet-5";
export function reportModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

/** Texto de la respuesta (bloques de texto concatenados). */
export function responseText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** JSON tolerante: quita vallas de codigo y texto alrededor del primer objeto. Devuelve null si no hay JSON. */
export function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const candidates = [cleaned];
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a >= 0 && b > a) candidates.push(cleaned.slice(a, b + 1));
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* siguiente */
    }
  }
  return null;
}
