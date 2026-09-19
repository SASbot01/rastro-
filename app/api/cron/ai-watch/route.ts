import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { takeWatchSnapshot, worthAlert } from "@/lib/ai-watch";
import { changeLines } from "@/lib/ai-watch-lines";
import { sendNoticeEmail } from "@/lib/email";
import { createLoginLink } from "@/lib/login-link";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { track } from "@/lib/events";
import { isCronSkipped } from "@/lib/demo-accounts";

/**
 * Comprobacion semanal de lo que dicen las IA (Pro con vigilancia activa).
 * Ligera: solo las preguntas a los asistentes + una ficha con Haiku. Si hay
 * un cambio relevante frente a la foto anterior, correo con las frases.
 * Cron diario; cada cuenta entra una vez cada 7 dias. Bearer CRON_SECRET.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 8;
const EVERY_DAYS = 7;

interface DueUser { id: string; email: string; locale: string; ai_watch_last_at: string | null }
interface LastRequest { full_name: string; city: string | null; occupation: string | null }

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });

  const supabase = supabaseAdmin();
  const cutoff = new Date(Date.now() - EVERY_DAYS * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, locale, ai_watch_last_at")
    .eq("monitoring", true)
    .eq("plan", "pro")
    .or(`ai_watch_last_at.is.null,ai_watch_last_at.lt.${cutoff}`)
    .order("ai_watch_last_at", { ascending: true, nullsFirst: true })
    .limit(BATCH)
    .returns<DueUser[]>();
  if (error) console.error("[cron/ai-watch] consulta fallo:", error.message);

  const results: Array<{ user: string; status: string; alerted?: boolean }> = [];
  for (const user of users ?? []) {
    const claim = supabase.from("users").update({ ai_watch_last_at: new Date().toISOString() }).eq("id", user.id);
    const { data: claimed } = await (user.ai_watch_last_at === null ? claim.is("ai_watch_last_at", null) : claim.lt("ai_watch_last_at", cutoff)).select("id").maybeSingle();
    if (!claimed) continue;
    // Cuentas de demostracion: datos preparados a mano; procesarlas de verdad estropea la demo. Ya reclamada, no vuelve a salir hasta el siguiente ciclo.
    if (isCronSkipped(user.email)) { results.push({ user: user.id, status: "demo: omitida" }); continue; }

    const { data: last } = await supabase.from("requests").select("full_name, city, occupation").eq("user_id", user.id).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle<LastRequest>();
    if (!last) { results.push({ user: user.id, status: "sin informe" }); continue; }

    const locale: Locale = isLocale(user.locale) ? user.locale : "es";
    const snap = await takeWatchSnapshot(user.id, last, locale);
    if (!snap) { results.push({ user: user.id, status: "sin respuestas" }); continue; }

    const alert = worthAlert(snap.changes);
    if (alert) {
      void track("ai_change_detected", { subject: user.id, locale, props: { changes: snap.changes.filter((c) => !c.minor).length, source: "watch" } });
      const tr = translator(getMessages(locale));
      try {
        const url = await createLoginLink(user.email, locale, "/ia");
        await sendNoticeEmail({
          to: user.email,
          subject: tr("aiWatch.email.subject"),
          greeting: tr("aiWatch.email.greeting", { name: last.full_name.split(" ")[0] }),
          paragraphs: [tr("aiWatch.email.intro"), ...changeLines(snap.changes, locale).slice(0, 6).map((l) => "• " + l), tr("aiWatch.email.outro")],
          cta: tr("aiWatch.email.cta"),
          url,
          footer: tr("aiWatch.email.footer"),
        });
      } catch (e) {
        console.error("[cron/ai-watch] correo fallo:", e);
      }
    }
    results.push({ user: user.id, status: "ok", alerted: alert });
  }
  console.log(`[cron/ai-watch] procesados ${results.length}:`, JSON.stringify(results));
  return NextResponse.json({ ok: true, processed: results.length, results });
}
