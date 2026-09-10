import { supabaseAdmin } from "@/lib/supabase";
import { getBreaches } from "@/lib/hibp";
import { searchName } from "@/lib/brave";
import { isLocale, type Locale } from "@/lib/i18n";
import { computeScore } from "@/lib/report/score";
import { buildActions, buildFindings, buildSummary, signalsFrom } from "@/lib/report/findings";

/**
 * Job del informe. Se lanza con `after()` desde /verify una vez la solicitud
 * esta en estado 'processing'. Cada paso deja rastro en `requests.step`
 * para que la pagina de espera muestre progreso real.
 */

export const REPORT_STEPS = ["hibp", "brave", "report"] as const;
export type ReportStep = (typeof REPORT_STEPS)[number];

/** Pasado este tiempo en 'processing' sin terminar, el job se da por muerto. */
export const STALE_AFTER_MS = 120_000;

interface RequestRow {
  id: string;
  email: string;
  full_name: string;
  city: string | null;
  locale: string;
  status: string;
  finished_at: string | null;
}

async function setStep(id: string, step: ReportStep): Promise<void> {
  await supabaseAdmin().from("requests").update({ step }).eq("id", id);
}

export async function runReportJob(requestId: string): Promise<void> {
  const supabase = supabaseAdmin();

  const { data: row, error } = await supabase
    .from("requests")
    .select("id, email, full_name, city, locale, status, finished_at")
    .eq("id", requestId)
    .maybeSingle<RequestRow>();

  if (error || !row) {
    console.error("[job] solicitud no encontrada:", requestId, error);
    return;
  }
  // Solo procesa lo que /verify reclamo como 'processing'. Evita dobles ejecuciones.
  if (row.status !== "processing" || row.finished_at) return;

  const locale: Locale = isLocale(row.locale) ? row.locale : "es";
  const startedAt = Date.now();

  try {
    await setStep(row.id, "hibp");
    const hibp = await getBreaches(row.email);

    await setStep(row.id, "brave");
    const brave = await searchName({ fullName: row.full_name, city: row.city, locale });

    await setStep(row.id, "report");
    const inputs = { hibp, brave, locale };
    const { score, breakdown } = computeScore(signalsFrom(hibp, brave));

    const { error: reportError } = await supabase.from("reports").upsert(
      {
        request_id: row.id,
        score,
        summary: buildSummary(inputs),
        findings: buildFindings(inputs),
        actions: buildActions(inputs),
        breakdown,
        raw: { hibp, brave, generated_in_ms: Date.now() - startedAt },
      },
      { onConflict: "request_id" },
    );
    if (reportError) throw new Error(`reports.upsert: ${reportError.message}`);

    await supabase
      .from("requests")
      .update({ status: "done", step: null, error: null, finished_at: new Date().toISOString() })
      .eq("id", row.id);

    console.log(`[job] informe ${row.id} listo en ${Date.now() - startedAt} ms, score ${score}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[job] informe ${row.id} fallo:`, message);
    await supabase
      .from("requests")
      .update({ status: "error", error: message.slice(0, 500), finished_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}
