import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";
import { LOCALES } from "@/lib/i18n";
import { allowByIp } from "@/lib/rate-limit";

/**
 * "Pregunta a Rastro": el muneco de la portada responde dudas sobre el
 * producto. Modelo pequeno, respuestas cortas, 40 preguntas por IP y dia.
 * No toca datos de usuarios: solo sabe lo que dice este prompt.
 */
export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_ASK_MODEL || "claude-haiku-4-5-20251001";
const MAX_TOKENS = 350;

const schema = z.object({
  question: z.string().trim().min(1).max(300),
  locale: z.enum(LOCALES).default("es"),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1200) })).max(6).default([]),
});

const KNOWLEDGE = `
Rastro (rastropro.com) responde a "¿qué sabe la IA de ti?".
- Informe GRATIS: nombre + correo (ciudad y profesión opcionales para no confundir homónimos). Se confirma el correo con un código de 6 dígitos; sin eso no se busca nada. Tarda 1-2 minutos.
- Qué revisa: filtraciones conocidas donde aparece tu correo (fuente Have I Been Pwned), lo que responden los asistentes de IA cuando preguntan por ti, perfiles y páginas públicas con tus datos, y datos falsos que la IA afirma sobre ti.
- Resultado: puntuación 0-100 (70-100 verde: poca exposición; 40-69 ámbar; 0-39 rojo), resumen en lenguaje llano, hallazgos ("qué se ve, por qué importa, qué hacer") y 3 acciones recomendadas. Se puede compartir una imagen con la puntuación y el nombre tapado.
- Solo sobre uno mismo: nunca se puede mirar a otra persona.
- Cuenta: se crea sola al confirmar el correo o con "Continuar con Google". Sin contraseñas.
- Rastro Pro: 19 €/mes o 99 €/año. Incluye vigilancia mensual (volvemos a mirar cada mes y avisamos solo si algo cambia), cartas de supresión RGPD (artículo 17) generadas para cada sitio, calendario de plazos (un mes para contestar), escrito de reclamación a la AEPD si no contestan, y el escáner de buzón (beta): conecta Gmail y lista en qué servicios estás registrado; solo lee remitente, asunto y fecha, no guarda correos y revoca el acceso al terminar.
- Privacidad: base legal consentimiento; sin cuenta los datos se borran a los 30 días; con cuenta se conservan mientras exista y se puede borrar cuando quiera. No vendemos ni compartimos datos. A los buscadores y a la IA solo se envía nombre (y ciudad/profesión si se dieron); a la base de filtraciones solo el correo.
- Cartas RGPD: Rastro puede ENVIARLAS por ti desde cartas@rastropro.com (con copia y respuesta a tu correo), reenvía un recordatorio a los 20 días si no contestan, guarda la cronología como prueba, comprueba si tu nombre sigue en la página y prepara la reclamación AEPD con la carta, el recordatorio y la respuesta del sitio.
- Guía de sitios (rastropro.com/sitios): 26 sitios (Dateas, Axesor, eInforma, Infocif, Infobel, Páginas Blancas, ZabaSearch, Spokeo, Radaris, Strava, LinkedIn…) con el contacto de privacidad y los pasos exactos de baja. Gratis, sin cuenta.
- Lo que responde cada IA: el informe muestra la respuesta literal de Perplexity y, si están configurados, de ChatGPT y Gemini, con enlace para pedir rectificación a cada proveedor. La ciudad es obligatoria en el formulario para no confundir homónimos.
- Simulador de ataque (rastropro.com/simulador): con tu propio informe, la IA te enseña 3 mensajes de phishing a tu medida, la llamada de estafa que te harían y una nota de "facilidad para engañarte" con las 3 defensas que más te protegen. Gratis 1 mensaje; Pro todo, más enviártelos a tu propio correo para vivir la experiencia. Todo es simulación, sin enlaces reales.
- Guardián (rastropro.com/guardian): pegas un SMS, correo o WhatsApp sospechoso y te dice si es estafa, por qué, qué datos tuyos usa y qué hacer. Gratis 5 al día; Pro sin límite y cruzado con tu informe. No guardamos el mensaje.
- Plan familiar: si está disponible, el titular añade a personas de su casa (hasta 3 en total) y cada una tiene su cuenta Pro.
- Identidad frente a la IA (v4): desde el informe, "Pedir rectificación con Rastro" crea la solicitud a ChatGPT/OpenAI, Gemini/Google, Perplexity, Meta AI o Copilot (arts. 16 y 17 RGPD) con la respuesta literal como prueba; se envía por Rastro donde aceptan correo. Y "Imágenes con tu nombre" (rastropro.com/imagenes, Pro): fotos que salen al buscar tu nombre y ciudad, con carta de retirada al sitio (derecho a la propia imagen).
- Rastro Equipos (v5, rastropro.com/equipos): para empresas. Cada empleado tiene su Pro completo; la empresa ve un panel con puntuación media, quién tiene contraseñas filtradas y quién vigila, SOLO si el empleado decide compartir su puntuación (nunca ve hallazgos ni datos). Precios orientativos 149 €/mes (10 personas) y 299 €/mes (25).
- Extensión Rastro Guardián (rastropro.com/extension, beta para Chrome/Edge/Brave): un robot arrastrable (tres modelos) que en cada web cuenta las cookies, dice cuántas empresas te siguen, si te rastrean antes de aceptar, y pone una nota 0-100 a la web; botón «Rechazar por mí». Todo se calcula en el navegador: no envía cookies ni historial a ningún sitio.
- API (rastropro.com/api-docs): clave en Perfil → API; endpoints para el catálogo de sitios, portales de IA, redactar cartas RGPD, analizar mensajes sospechosos (Pro), calcular la puntuación y leer TUS propios informes. Nunca datos de terceros. 1.000 peticiones/día.
- Cómo lo hacemos (rastropro.com/como-funciona): fuentes, qué guardamos, cuánto tiempo, regla de la puntuación y seguridad.
- Nunca prometemos borrar: damos visibilidad y herramientas para reclamar.
- Soporte: página /soporte. Pro: página /pro. Pedir informe: formulario en la portada.
`;

function system(locale: "es" | "en") {
  const lang = locale === "es" ? "español" : "English";
  return `Eres el muñeco de Rastro, el asistente de la web. Respondes SOLO sobre Rastro usando la información de abajo. Tono cercano, claro, sin jerga ni alarmismo, sin vender. Respuestas cortas: 1-3 frases, máximo 5. Texto plano: sin markdown, sin asteriscos, sin listas, sin emojis. Si no sabes algo o es sobre la cuenta concreta de la persona, dilo y remite a Soporte (/soporte). No inventes precios ni funciones. No des consejo legal individual. Responde siempre en ${lang}.\n\nINFORMACIÓN:\n${KNOWLEDGE}`;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: serverEnv.anthropicApiKey, timeout: 25_000, maxRetries: 1 });
  return client;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "ask.error" }, { status: 400 });
  const { question, locale, history } = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "0.0.0.0";
  if (!(await allowByIp(ip, "ask"))) return NextResponse.json({ ok: false, error: "ask.limit" }, { status: 429 });

  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: system(locale),
      messages: [...history, { role: "user", content: question }],
    });
    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!answer) throw new Error("respuesta vacia");
    return NextResponse.json({ ok: true, answer });
  } catch (error) {
    console.error("[/api/ask] fallo:", error);
    return NextResponse.json({ ok: false, error: "ask.error" }, { status: 500 });
  }
}
