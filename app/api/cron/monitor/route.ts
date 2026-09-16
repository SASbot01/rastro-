import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runReportJob } from "@/lib/report/job";
import { diffLines, diffReports, type ReportSnapshot } from "@/lib/report/diff";
import { sendMonitorEmail } from "@/lib/email";
import { createLoginLink } from "@/lib/login-link";
import { isLocale, type Locale } from "@/lib/i18n";

/**
 * Monitorizacion mensual (semana 2). Cron diario: coge hasta BATCH usuarios
 * con la vigilancia activa cuya ultima comprobacion tenga mas de 30 dias,
 * regenera su informe (origin='monitor', sin cache) y, si hay cambios frente
 * al anterior, envia el correo de novedades con enlace que abre sesion.
 * Protegido con Authorization: Bearer CRON_SECRET.
 */
export const runtime = "nodejs";
export const maxDuration = 300; // 5 informes x ~45 s

const BATCH = 5;
const EVERY_DAYS = 30;

interface DueUser { id: string; email: string; locale: string; monitor_last_at: string | null }
interface LastRequest { id: string; full_name: string; city: string | null; occupation: string | null; consent_at: string; locale: string }
interface ReportRow { score: number; raw: ReportSnapshot["raw"] }

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const supabase = supabaseAdmin();
  // Sin milisegundos: el punto rompe el parser del filtro `or` de PostgREST.
  const cutoff = new Date(Date.now() - EVERY_DAYS * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, locale, monitor_last_at")
    .eq("monitoring", true)
    .eq("plan", "pro")
    .or(`monitor_last_at.is.null,monitor_last_at.lt.${cutoff}`)
    .order("monitor_last_at", { ascending: true, nullsFirst: true })
    .limit(BATCH)
    .returns<DueUser[]>();
  if (usersError) console.error("[cron/monitor] consulta de usuarios fallo:", usersError.message);

  const results: Array<{ user: string; status: string; changed?: boolean }> = [];

  for (const user of users ?? []) {
    // Reclamar primero: si el cron se solapa, nadie procesa dos veces al mismo usuario.
    // (PostgREST no acepta un filtro `or` en UPDATE; se elige el filtro segun el caso.)
    const claim = supabase.from("users").update({ monitor_last_at: new Date().toISOString() }).eq("id", user.id);
    const { data: claimed, error: claimError } = await (user.monitor_last_at === null
      ? claim.is("monitor_last_at", null)
      : claim.lt("monitor_last_at", cutoff)
    )
      .select("id")
      .maybeSingle();
    if (claimError) console.error("[cron/monitor] reclamacion fallo:", claimError.message);
    if (!claimed) continue;

    const locale: Locale = isLocale(user.locale) ? user.locale : "es";

    const { data: last } = await supabase
      .from("requests")
      .select("id, full_name, city, occupation, consent_at, locale")
      .eq("user_id", user.id)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<LastRequest>();
    if (!last) {
      results.push({ user: user.id, status: "sin informe previo" });
      continue;
    }
    const { data: prevReport } = await supabase
      .from("reports")
      .select("score, raw")
      .eq("request_id", last.id)
      .maybeSingle<ReportRow>();

    const now = new Date().toISOString();
    const { data: created, error } = await supabase
      .from("requests")
      .insert({
        email: user.email,
        full_name: last.full_name,
        city: last.city,
        occupation: last.occupation,
        locale,
        consent_at: last.consent_at,
        verified_at: now,
        status: "processing",
        started_at: now,
        ip_hash: "monitor",
        origin: "monitor",
        user_id: user.id,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !created) {
      results.push({ user: user.id, status: `insert fallo: ${error?.message}` });
      continue;
    }

    await runReportJob(created.id);

    const { data: nextReport } = await supabase
      .from("reports")
      .select("score, raw")
      .eq("request_id", created.id)
      .maybeSingle<ReportRow>();
    if (!nextReport || !prevReport) {
      results.push({ user: user.id, status: nextReport ? "primer informe monitorizado" : "job fallo" });
      continue;
    }

    const diff = diffReports(prevReport, nextReport);
    await supabase.from("reports").update({ raw: { ...(nextReport.raw ?? {}), diff } }).eq("request_id", created.id);

    if (diff.changed) {
      const reportUrl = await createLoginLink(user.email, locale, `/informe/${created.id}`);
      const unsubscribeUrl = await createLoginLink(user.email, locale, "/cuenta");
      try {
        await sendMonitorEmail({
          to: user.email,
          name: last.full_name.split(" ")[0],
          score: nextReport.score,
          lines: diffLines(diff, locale),
          reportUrl,
          unsubscribeUrl,
          locale,
        });
      } catch (err) {
        console.error("[cron/monitor] correo fallo:", err);
      }
    }
    results.push({ user: user.id, status: "ok", changed: diff.changed });
  }

  console.log(`[cron/monitor] procesados ${results.length}:`, JSON.stringify(results));
  return NextResponse.json({ ok: true, processed: results.length, results });
}
