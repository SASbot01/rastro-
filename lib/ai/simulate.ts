import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, parseJsonLoose, reportModel, responseText } from "@/lib/ai/client";
import type { Locale } from "@/lib/i18n";
import type { Finding } from "@/lib/report/findings";
import type { KnownAccount } from "@/lib/report/accounts";

/**
 * v2 — Simulador de ataque personal. Con lo que YA es publico de la persona
 * (su propio informe) la IA muestra como la engañarian: 3 mensajes de phishing
 * a medida, el guion de una llamada de estafa y una nota de "atacabilidad".
 * Todo esta marcado como simulacion, sin enlaces reales y solo sobre uno mismo.
 */

export const SimulationSchema = z.object({
  attackability: z.number().min(0).max(100),
  attackability_reason: z.string(),
  defenses: z.array(z.object({ title: z.string(), detail: z.string() })).min(3),
  phishing: z
    .array(
      z.object({
        channel: z.enum(["email", "sms", "whatsapp"]),
        pretext: z.string(),
        from_name: z.string(),
        from_address: z.string(),
        subject: z.string(),
        body: z.string(),
        clues: z.array(z.string()).min(2),
      }),
    )
    .min(3),
  vishing: z.object({
    scenario: z.string(),
    caller_claims: z.string(),
    script: z.array(z.object({ who: z.enum(["caller", "you"]), line: z.string() })).min(4),
    red_flags: z.array(z.string()).min(2),
    hang_up: z.string(),
  }),
});
export type Simulation = z.infer<typeof SimulationSchema>;

const SYSTEM = `Eres el simulador de ataques de Rastro: un servicio de concienciación en el que una persona ve, con sus PROPIOS datos públicos, cómo la engañarían. Recibes su informe de exposición (filtraciones, cuentas conocidas, lo que la IA sabe de ella, perfiles) y produces material de formación sobre ELLA MISMA.

REGLAS
- Todo es una simulación con fines educativos y va marcado como tal. No produces nada utilizable contra terceros: no hay enlaces reales, ni datos de terceros, ni instrucciones para atacar a nadie.
- Enlaces: usa siempre https://simulacion.rastropro.com/... . Números de teléfono: usa 600 000 000. Cuentas bancarias, DNI o tarjetas: nunca.
- Personaliza con lo que hay en el informe: servicios donde tiene cuenta, filtraciones (nombre del servicio y año), empleo, ciudad, aficiones visibles, perfiles. Cuanto más creíble, más aprende. Si un dato no está, no lo inventes: usa el pretexto genérico.
- Cada mensaje de phishing explica su "pretexto" (qué dato público lo hace creíble) y 2-4 "pistas" para descubrirlo (remitente, urgencia, enlace, error sutil).
- El guion de vishing es una llamada corta (6-12 líneas) donde el estafador usa sus datos públicos; termina con qué decir para colgar sin dar nada.
- attackability (0-100): 0 = casi imposible de engañar con lo público; 100 = cualquiera podría. Súbelo con contraseñas filtradas, empleo y ciudad conocidos, teléfono público, muchas cuentas antiguas; bájalo si hay poca información. Explica en una frase.
- Tres defensas concretas y ordenadas por impacto para ESTA persona (2FA, alias de correo, gestor de contraseñas, privacidad de perfiles, verificar por otro canal...).
- Tono: claro, cercano, sin alarmismo, sin jerga. Escribe en el idioma indicado.`;

export interface SimulationInput {
  locale: Locale;
  fullName: string;
  email: string;
  city: string | null;
  occupation: string | null;
  score: number;
  summary: string;
  findings: Finding[];
  accounts: KnownAccount[];
}

export async function buildSimulation(input: SimulationInput): Promise<{ ok: true; simulation: Simulation; model: string } | { ok: false; detail: string }> {
  const model = reportModel();
  const payload = {
    language: input.locale === "es" ? "español (de España)" : "English",
    person: { name: input.fullName, email_domain: input.email.split("@")[1] ?? "", city: input.city, occupation: input.occupation },
    exposure_score: input.score,
    summary: input.summary,
    findings: input.findings.slice(0, 14).map((f) => ({ category: f.category, title: f.title, severity: f.severity })),
    known_accounts: input.accounts.slice(0, 20).map((a) => ({ name: a.name, from_breach: a.source === "breach", year: a.date?.slice(0, 4) ?? null, password_leaked: a.hasPassword })),
  };
  try {
    const response = await anthropic(90_000).messages.create({
      model,
      max_tokens: 6000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Informe de la persona (JSON). Genera la simulación en "language".\n\n${JSON.stringify(payload)}` }],
      output_config: { effort: "medium", format: zodOutputFormat(SimulationSchema) },
    });
    if (response.stop_reason === "refusal") return { ok: false, detail: "refusal" };
    const text = responseText(response);
    const parsed = SimulationSchema.safeParse(parseJsonLoose(text));
    if (!parsed.success) {
      console.warn("[ai] salida no valida:", parsed.error.issues.slice(0, 3).map((i) => i.path.join(".") + ": " + i.message).join("; "), "|", text.slice(0, 200));
      return { ok: false, detail: "parse" };
    }
    const d = parsed.data;
    const simulation: Simulation = { ...d, attackability: Math.round(d.attackability), defenses: d.defenses.slice(0, 3), phishing: d.phishing.slice(0, 3).map((p) => ({ ...p, clues: p.clues.slice(0, 4) })), vishing: { ...d.vishing, script: d.vishing.script.slice(0, 12), red_flags: d.vishing.red_flags.slice(0, 4) } };
    return { ok: true, simulation, model };
  } catch (e) {
    return { ok: false, detail: String(e).slice(0, 200) };
  }
}
