import { supabaseAdmin } from "@/lib/supabase";
import { getBreaches, getPastes, type HibpResult } from "@/lib/hibp";
import { getGravatar } from "@/lib/gravatar";
import { buildAccounts } from "@/lib/report/accounts";
import { searchName } from "@/lib/brave";
import { askAboutPerson } from "@/lib/perplexity";
import { askAssistants } from "@/lib/assistants";
import { writeReport, type PreviousAi } from "@/lib/ai/report";
import { isLocale, type Locale } from "@/lib/i18n";
import { normalizeEmail } from "@/lib/crypto";
import { computeScore } from "@/lib/report/score";
import { buildActions, buildFindings, buildSummary, signalsFrom } from "@/lib/report/findings";
import { answersFromRaw, saveSnapshot } from "@/lib/ai-watch";
import { track } from "@/lib/events";

/**
 * Job del informe. Se lanza con `after()` desde /verify una vez la solicitud
 * esta en estado 'processing'. Cada paso deja rastro en `requests.step`
 * para que la pagina de espera muestre progreso real.
 *
 *   hibp   -> brechas por correo
 *   brave  -> resultados por nombre
 *   ai     -> Perplexity (3 preguntas) + Anthropic (redaccion y senales)
 *   report -> score determinista + guardado
 *
 * Cache (CLAUDE.md s.4.8): si el mismo correo ya tiene un informe de menos
 * de 30 dias con el mismo nombre y ciudad, se copia entero (0 llamadas a
 * APIs). Si solo coincide el correo, se reutiliza la respuesta de HIBP.
 *
 * Si Anthropic falla, el informe se genera igualmente con plantillas
 * (generator = 'template'): nunca se deja al usuario sin informe.
 */

export const REPORT_STEPS = ["hibp", "brave", "ai", "report"] as const;
export type ReportStep = (typeof REPORT_STEPS)[number];

/** Pasado este tiempo en 'processing' sin terminar, el job se da por muerto. */
export const STALE_AFTER_MS = 120_000;
const CACHE_DAYS = 30;

interface RequestRow {
  id: string;
  email: string;
  full_name: string;
  city: string | null;
  occupation: string | null;
  locale: string;
  status: string;
  finished_at: string | null;
  origin: "user" | "monitor";
  user_id: string | null;
}

interface CachedReport {
  request_id: string;
  score: number;
  summary: string;
  findings: unknown;
  actions: unknown;
  breakdown: unknown;
  accounts: unknown;
  generator: string;
  raw: { hibp?: HibpResult } | null;
}

async function setStep(id: string, step: ReportStep): Promise<void> {
  await supabaseAdmin().from("requests").update({ step }).eq("id", id);
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/** Ultimo informe terminado para el mismo correo dentro de la ventana de cache. */
async function findCached(row: RequestRow): Promise<{ request: RequestRow; report: CachedReport } | null> {
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
  const { data: prev } = await supabase
    .from("requests")
    .select("id, email, full_name, city, occupation, locale, status, finished_at, origin, user_id")
    .ilike("email", normalizeEmail(row.email))
    .eq("status", "done")
    .neq("id", row.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RequestRow>();
  if (!prev) return null;

  const { data: report } = await supabase
    .from("reports")
    .select("request_id, score, summary, findings, actions, breakdown, accounts, generator, raw")
    .eq("request_id", prev.id)
    .maybeSingle<CachedReport>();
  return report ? { request: prev, report } : null;
}

/** Valoracion de la IA en el ultimo informe terminado de la misma persona (monitorizacion). */
async function previousAssessment(row: RequestRow): Promise<PreviousAi | null> {
  const { data: prev } = await supabaseAdmin()
    .from("requests")
    .select("id")
    .ilike("email", normalizeEmail(row.email))
    .eq("status", "done")
    .neq("id", row.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!prev) return null;
  const { data: report } = await supabaseAdmin()
    .from("reports")
    .select("raw")
    .eq("request_id", prev.id)
    .maybeSingle<{ raw: { ai?: PreviousAi & { failed?: string } } | null }>();
  const ai = report?.raw?.ai;
  return ai && !ai.failed && ai.signals ? { identity_confidence: ai.identity_confidence, signals: ai.signals, attributed_profile_urls: ai.attributed_profile_urls ?? [] } : null;
}

export async function runReportJob(requestId: string): Promise<void> {
  const supabase = supabaseAdmin();

  const { data: row, error } = await supabase
    .from("requests")
    .select("id, email, full_name, city, occupation, locale, status, finished_at, origin, user_id")
    .eq("id", requestId)
    .maybeSingle<RequestRow>();

  if (error || !row) {
    console.error("[job] solicitud no encontrada:", requestId, error);
    return;
  }
  // Solo procesa lo que /verify reclamo como 'processing'. Evita dobles ejecuciones.
  if (row.status !== "processing" || row.finished_at) return;

  const locale: Locale = isLocale(row.locale) ? row.locale : "es";
  const person = { full_name: row.full_name, city: row.city, occupation: row.occupation, locale };
  const startedAt = Date.now();

  try {
    // La monitorizacion mensual existe para refrescar: nunca usa la cache.
    const cached = row.origin === "monitor" ? null : await findCached(row);

    // Cache completa: mismo correo, nombre, ciudad e idioma -> copia sin tocar APIs.
    if (
      cached &&
      cached.report.generator === "ai" && // un informe de plantilla (IA caida) no vale como cache
      sameText(cached.request.full_name, row.full_name) &&
      sameText(cached.request.city, row.city) &&
      sameText(cached.request.occupation, row.occupation) &&
      cached.request.locale === row.locale
    ) {
      await setStep(row.id, "report");
      const { request_id: from, raw, ...content } = cached.report;
      const { error: copyError } = await supabase.from("reports").upsert(
        { request_id: row.id, ...content, raw: { cached_from: from, hibp: raw?.hibp ?? null } },
        { onConflict: "request_id" },
      );
      if (copyError) throw new Error(`reports.upsert (cache): ${copyError.message}`);
      await supabase
        .from("requests")
        .update({ status: "done", step: null, error: null, finished_at: new Date().toISOString() })
        .eq("id", row.id);
      console.log(`[job] informe ${row.id} copiado de ${from} (cache, ${Date.now() - startedAt} ms)`);
      return;
    }

    await setStep(row.id, "hibp");
    // Cache parcial: HIBP depende solo del correo, y sus resultados cambian poco.
    const [hibp, pastes, gravatar] = await Promise.all([
      cached?.report.raw?.hibp?.checked ? Promise.resolve(cached.report.raw.hibp) : getBreaches(row.email),
      getPastes(row.email),
      getGravatar(row.email),
    ]);
    const accounts = buildAccounts(hibp, gravatar);

    await setStep(row.id, "brave");
    const brave = await searchName({ fullName: row.full_name, city: row.city, occupation: row.occupation, locale });

    await setStep(row.id, "ai");
    // Perplexity (3 preguntas) y los demas asistentes configurados (1 pregunta cada uno), en paralelo.
    const [perplexity, assistants] = await Promise.all([
      askAboutPerson({ fullName: row.full_name, city: row.city, occupation: row.occupation, locale }),
      askAssistants({ fullName: row.full_name, city: row.city, occupation: row.occupation, locale }),
    ]);
    const previous = row.origin === "monitor" ? await previousAssessment(row) : null;
    const ai = await writeReport({ person, hibp, brave, perplexity, assistants: assistants.answers, pastes, gravatar, accounts, previous });
    if (!ai.ok) console.warn(`[job] ${row.id}: Anthropic no disponible (${ai.reason} ${ai.detail ?? ""}); usando plantillas`);

    await setStep(row.id, "report");
    const inputs = { hibp, brave, locale };

    // Solo puntuan los perfiles que la IA atribuye a la persona (homonimos fuera).
    const attributed = ai.ok
      ? brave.ok
        ? brave.hits.filter((h) => h.kind === "profile" && ai.report.attributed_profile_urls.includes(h.url)).length
        : 0
      : undefined;
    const pasteCount = pastes.checked ? pastes.pastes.length : 0;
    const { score, breakdown } = computeScore(signalsFrom(hibp, brave, ai.ok ? ai.report.signals : undefined, attributed, pasteCount));

    const content = ai.ok
      ? { summary: ai.report.summary, findings: ai.report.findings, actions: ai.report.actions, generator: "ai" as const }
      : { summary: buildSummary(inputs), findings: buildFindings(inputs), actions: buildActions(inputs), generator: "template" as const };

    const { error: reportError } = await supabase.from("reports").upsert(
      {
        request_id: row.id,
        score,
        breakdown,
        accounts,
        ...content,
        raw: {
          hibp,
          pastes,
          gravatar,
          brave,
          perplexity,
          assistants,
          ai: ai.ok
            ? {
                model: ai.model,
                usage: ai.usage,
                identity_confidence: ai.report.identity_confidence,
                signals: ai.report.signals,
                attributed_profile_urls: ai.report.attributed_profile_urls,
              }
            : { failed: ai.reason, detail: ai.detail },
          hibp_from_cache: Boolean(cached?.report.raw?.hibp?.checked),
          generated_in_ms: Date.now() - startedAt,
        },
      },
      { onConflict: "request_id" },
    );
    if (reportError) throw new Error(`reports.upsert: ${reportError.message}`);

    await supabase
      .from("requests")
      .update({ status: "done", step: null, error: null, finished_at: new Date().toISOString() })
      .eq("id", row.id);

    // Memoria de lo que dice cada IA (solo con cuenta). Despues de marcar 'done': no retrasa el informe.
    if (row.user_id) {
      await saveSnapshot({ userId: row.user_id, requestId: row.id, source: "report", person: { full_name: row.full_name, city: row.city, occupation: row.occupation }, locale, answers: answersFromRaw(perplexity, assistants.answers) }).catch((e) => console.warn("[job] foto de IA fallo:", String(e).slice(0, 160)));
    }
    void track("report_ready", { subject: row.id, locale, props: { origin: row.origin, generator: content.generator, seconds: Math.round((Date.now() - startedAt) / 1000), score } });

    const tokens = ai.ok ? `${ai.usage.input_tokens}in/${ai.usage.output_tokens}out` : "sin IA";
    console.log(`[job] informe ${row.id} listo en ${Date.now() - startedAt} ms, score ${score}, ${content.generator} (${tokens})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[job] informe ${row.id} fallo:`, message);
    void track("report_failed", { subject: row.id, locale });
    await supabase
      .from("requests")
      .update({ status: "error", error: message.slice(0, 500), finished_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}
