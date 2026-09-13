import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { writeReport, type InputData } from "@/lib/ai/report";
import { computeScore } from "@/lib/report/score";
import { signalsFrom } from "@/lib/report/findings";
import { isLocale, type Locale } from "@/lib/i18n";

/**
 * Reparacion de informes que quedaron en plantilla (generator='template')
 * porque la IA fallo en su momento. Reutiliza lo ya recopilado en `raw`
 * (HIBP, Brave, Perplexity...) y solo repite el paso de redaccion: no vuelve
 * a pagar busquedas. Cron diario. Protegido con Authorization: Bearer CRON_SECRET.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 5;
const MAX_AGE_DAYS = 7;

interface Row {
  request_id: string;
  raw: Partial<Pick<InputData, "hibp" | "brave" | "perplexity" | "pastes" | "gravatar" | "accounts">> & { assistants?: { answers?: InputData["assistants"] } } & Record<string, unknown>;
  requests: { full_name: string; city: string | null; occupation: string | null; locale: string; status: string } | Array<{ full_name: string; city: string | null; occupation: string | null; locale: string; status: string }> | null;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });

  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString();
  const { data: rows, error } = await supabase
    .from("reports")
    .select("request_id, raw, requests!inner(full_name, city, occupation, locale, status)")
    .eq("generator", "template")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(BATCH)
    .returns<Row[]>();
  if (error) {
    console.error("[cron/repair] consulta fallo:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const results: Array<{ id: string; status: string }> = [];
  for (const row of rows ?? []) {
    const req = Array.isArray(row.requests) ? row.requests[0] : row.requests;
    const raw = row.raw;
    if (!req || !raw?.hibp || !raw.brave || !raw.perplexity) {
      results.push({ id: row.request_id, status: "sin datos" });
      continue;
    }
    const locale: Locale = isLocale(req.locale) ? req.locale : "es";
    const ai = await writeReport({
      person: { full_name: req.full_name, city: req.city, occupation: req.occupation, locale },
      hibp: raw.hibp,
      brave: raw.brave,
      perplexity: raw.perplexity,
      assistants: raw.assistants?.answers,
      pastes: raw.pastes,
      gravatar: raw.gravatar,
      accounts: raw.accounts,
    });
    if (!ai.ok) {
      console.warn(`[cron/repair] ${row.request_id}: IA sigue fallando (${ai.reason} ${ai.detail ?? ""})`);
      results.push({ id: row.request_id, status: `fallo: ${ai.reason}` });
      continue;
    }

    // Mismo calculo que el job: solo puntuan los perfiles atribuidos.
    const attributed = raw.brave.ok ? raw.brave.hits.filter((h) => h.kind === "profile" && ai.report.attributed_profile_urls.includes(h.url)).length : 0;
    const pasteCount = raw.pastes?.checked ? raw.pastes.pastes.length : 0;
    const { score, breakdown } = computeScore(signalsFrom(raw.hibp, raw.brave, ai.report.signals, attributed, pasteCount));

    const { error: upError } = await supabase
      .from("reports")
      .update({
        score,
        breakdown,
        summary: ai.report.summary,
        findings: ai.report.findings,
        actions: ai.report.actions,
        generator: "ai",
        raw: {
          ...raw,
          ai: { model: ai.model, usage: ai.usage, identity_confidence: ai.report.identity_confidence, signals: ai.report.signals, attributed_profile_urls: ai.report.attributed_profile_urls, repaired_at: new Date().toISOString() },
        },
      })
      .eq("request_id", row.request_id);
    if (upError) {
      console.error(`[cron/repair] ${row.request_id}: guardar fallo:`, upError.message);
      results.push({ id: row.request_id, status: "error guardando" });
      continue;
    }
    console.log(`[cron/repair] informe ${row.request_id} reparado: score ${score}`);
    results.push({ id: row.request_id, status: `reparado (${score})` });
  }

  return NextResponse.json({ ok: true, results });
}
