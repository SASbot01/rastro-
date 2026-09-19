import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getBreaches, getPastes } from "@/lib/hibp";
import { sendDailyEmail } from "@/lib/email";
import { createLoginLink } from "@/lib/login-link";
import { absoluteUrl } from "@/lib/env";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { isPro } from "@/lib/plan";
import { dailyOutcome } from "@/lib/daily-core";

/**
 * Comprobacion diaria barata (Pro con vigilancia): solo HIBP por correo
 * (brechas + pastes). Compara con el dia anterior (o con el ultimo informe)
 * y avisa por correo solo si aparece algo nuevo. Cron diario a las 7:00.
 * Protegido con Authorization: Bearer CRON_SECRET.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 40;
const PAUSE_MS = 1600; // HIBP: ~1 peticion por segundo y medio por clave

interface DueUser { id: string; email: string; locale: string; plan: "free" | "pro"; plan_until: string | null }
interface PrevCheck { breaches: number; pastes: number; new_breaches: string[]; day: string }
interface LastReport { request_id: string; raw: { hibp?: { checked: boolean; breaches?: Array<{ name: string }> }; pastes?: { checked: boolean; pastes?: unknown[] } } | null }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });

  const supabase = supabaseAdmin();
  // Dia en hora de Espana (el perfil y el cron viven en esa zona), formato YYYY-MM-DD.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, locale, plan, plan_until")
    .eq("monitoring", true)
    .eq("plan", "pro")
    .limit(BATCH)
    .returns<DueUser[]>();
  if (error) {
    console.error("[cron/daily] consulta fallo:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const results: Array<{ user: string; status: string }> = [];
  for (const user of users ?? []) {
    if (!isPro(user)) continue;
    // Ya comprobado hoy (cron solapado o relanzado): saltar.
    const { data: todayRow } = await supabase.from("daily_checks").select("id").eq("user_id", user.id).eq("day", today).maybeSingle();
    if (todayRow) {
      results.push({ user: user.id, status: "ya hecho hoy" });
      continue;
    }

    // Una peticion a HIBP cada vez (el limite es por clave): las dos a la vez hacian que una se llevara un 429.
    const hibp = await getBreaches(user.email);
    if (!hibp.checked) {
      await supabase.from("daily_checks").insert({ user_id: user.id, day: today, status: "error" });
      results.push({ user: user.id, status: `hibp: ${hibp.reason}` });
      await sleep(PAUSE_MS);
      continue;
    }
    await sleep(PAUSE_MS);
    const pastes = await getPastes(user.email);
    const names = hibp.breaches.map((b) => b.name);

    // Referencia: la ultima comprobacion; si no hay, el ultimo informe completo.
    const { data: prev } = await supabase
      .from("daily_checks")
      .select("breaches, pastes, new_breaches, day")
      .eq("user_id", user.id)
      .neq("status", "error")
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle<PrevCheck>();
    const { data: report } = await lastReport(user.id);
    // Nombres conocidos = los del ultimo informe + los avisados en comprobaciones anteriores.
    const knownNames = (report?.raw?.hibp?.breaches ?? []).map((b) => b.name);
    if (prev) {
      const { data: alerts } = await supabase.from("daily_checks").select("new_breaches").eq("user_id", user.id).returns<{ new_breaches: string[] }[]>();
      for (const a of alerts ?? []) knownNames.push(...(a.new_breaches ?? []));
    }
    // La decision (pura, con tests) vive en lib/daily-core.ts: un fallo al mirar los volcados no es "0 volcados".
    const { newBreaches, newPastes, pastesToStore: pasteCount } = dailyOutcome({
      names,
      pastes: pastes.checked ? pastes.pastes.length : null,
      knownNames,
      prevBreaches: prev ? prev.breaches : null,
      knownPastes: prev ? prev.pastes : report?.raw?.pastes?.checked ? (report.raw.pastes.pastes?.length ?? 0) : null,
      reportChecked: Boolean(report?.raw?.hibp?.checked),
    });
    const alert = newBreaches.length > 0 || newPastes > 0;

    await supabase.from("daily_checks").insert({
      user_id: user.id,
      day: today,
      breaches: names.length,
      pastes: pasteCount,
      new_breaches: newBreaches,
      new_pastes: newPastes,
      status: alert ? "alert" : "ok",
    });

    if (alert) {
      const locale: Locale = isLocale(user.locale) ? user.locale : "es";
      const reportPath = report ? `/informe/${report.request_id}` : "/cuenta";
      try {
        const link = await createLoginLink(user.email, locale, reportPath);
        const lines = [
          ...newBreaches.map((n) => tr(locale, "dailyEmail.newBreach", { name: n })),
          ...(newPastes > 0 ? [tr(locale, "dailyEmail.newPastes", { n: newPastes })] : []),
        ];
        await sendDailyEmail({ to: user.email, name: user.email.split("@")[0], lines, reportUrl: link, unsubscribeUrl: absoluteUrl("/herramientas").toString(), locale });
      } catch (e) {
        console.error(`[cron/daily] correo a ${user.id} fallo:`, e);
      }
    }
    results.push({ user: user.id, status: alert ? `alerta (${newBreaches.length} brechas, ${newPastes} pastes)` : "ok" });
    await sleep(PAUSE_MS);
  }

  return NextResponse.json({ ok: true, results });

  function lastReport(userId: string) {
    return supabase
      .from("reports")
      .select("request_id, raw, requests!inner(user_id, status)")
      .eq("requests.user_id", userId)
      .eq("requests.status", "done")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<LastReport>();
  }
}

function tr(locale: Locale, key: string, vars?: Record<string, string | number>) {
  return translator(getMessages(locale))(key, vars);
}
