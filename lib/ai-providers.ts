/**
 * v4 — Identidad frente a la IA: donde y como pedir a cada proveedor que
 * rectifique o deje de generar datos sobre ti (arts. 16 y 17 RGPD).
 * Contenido mantenido a mano, como el catalogo de sitios.
 */
export type AiProviderKey = "openai" | "gemini" | "perplexity" | "meta" | "microsoft";

export interface AiProvider {
  key: AiProviderKey;
  name: string;
  host: string;
  /** Correo de derechos de datos, si el proveedor acepta correo. */
  email: string | null;
  /** Formulario o portal de derechos. */
  url: string;
  confidence: "verified" | "likely";
  checked: string;
  steps: string[];
  typicalDays: number | null;
}

export const AI_PROVIDERS: Record<AiProviderKey, AiProvider> = {
  openai: {
    key: "openai",
    name: "ChatGPT (OpenAI)",
    host: "openai.com",
    email: "dsar@openai.com",
    url: "https://privacy.openai.com/",
    confidence: "verified",
    checked: "2026-09-13",
    steps: [
      "Entra en privacy.openai.com y elige «Make a Privacy Request» → «Remove my personal data from ChatGPT's responses» (o rectificación).",
      "Pega la respuesta literal que te dio ChatGPT y explica qué es falso o qué quieres que deje de generar. Adjunta la carta de Rastro.",
      "También puedes escribir a dsar@openai.com con la misma carta. Contestan por correo, normalmente en 2-4 semanas.",
    ],
    typicalDays: 30,
  },
  gemini: {
    key: "gemini",
    name: "Gemini (Google)",
    host: "google.com",
    email: null,
    url: "https://support.google.com/legal/troubleshooter/1114905",
    confidence: "verified",
    checked: "2026-09-13",
    steps: [
      "Abre el formulario legal de Google («Eliminar contenido de Google») y elige el producto Gemini / Búsqueda.",
      "Indica que se trata de datos personales inexactos o sin base legal (RGPD arts. 16/17), pega la respuesta y las URL de origen.",
      "Para la información que sale en el buscador, usa además «Resultados sobre ti».",
    ],
    typicalDays: 14,
  },
  perplexity: {
    key: "perplexity",
    name: "Perplexity",
    host: "perplexity.ai",
    email: "support@perplexity.ai",
    url: "https://www.perplexity.ai/hub/legal/privacy-policy",
    confidence: "likely",
    checked: "2026-09-13",
    steps: ["Envía la carta a support@perplexity.ai con asunto «GDPR data subject request» y la respuesta literal que te dio.", "Pide también la retirada en las fuentes que cita: Perplexity repite lo que encuentra."],
    typicalDays: 30,
  },
  meta: {
    key: "meta",
    name: "Meta AI (Facebook, Instagram, WhatsApp)",
    host: "meta.com",
    email: null,
    url: "https://www.facebook.com/help/contact/510058597260253",
    confidence: "likely",
    checked: "2026-09-13",
    steps: ["Usa el formulario de Meta «Derechos del interesado para la IA de terceros» y describe qué información sobre ti quieres que rectifiquen o eliminen.", "Adjunta capturas de la respuesta de Meta AI y la carta."],
    typicalDays: 30,
  },
  microsoft: {
    key: "microsoft",
    name: "Copilot (Microsoft)",
    host: "microsoft.com",
    email: null,
    url: "https://www.microsoft.com/es-es/concern/bing",
    confidence: "likely",
    checked: "2026-09-13",
    steps: ["Formulario de retirada de contenido de Bing/Copilot: elige «Privacidad» y pega la URL de la respuesta o las fuentes.", "Adjunta la carta y la respuesta literal."],
    typicalDays: 14,
  },
};
