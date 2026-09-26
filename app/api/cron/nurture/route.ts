import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendNoticeEmail } from "@/lib/email";
import { createLoginLink } from "@/lib/login-link";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { isPro, prices } from "@/lib/plan";
import { dueStep, stopUrl } from "@/lib/nurture";
import { removalStats } from "@/lib/removals";
import { isCronSkipped } from "@/lib/demo-accounts";
import { track } from "@/lib/events";

/**
 * Correos tras el primer informe: dia 1 (que hacer primero), dia 3 (como
 * retiramos y lo comprobamos, con sus sitios), dia 7 (Pro con el precio de
 * lanzamiento). Cron diario. Solo cuentas gratis que no han parado la
 * secuencia. Bearer CRON_SECRET.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

const BATCH = 60;

interface Row { id: string; email: string; locale: string; plan: "free" | "pro"; plan_until: string | null; nurture_step: number; nurture_opt_out: boolean }
interface FirstReport { request_id: string; created_at: string; actions: Array<{ title: string }> | null; findings: Array<{ category: string }> | null; requests: { full_name: string } | { full_name: string }[] | null }

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });
  const supabase = supabaseAdmin();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, locale, plan, plan_until, nurture_step, nurture_opt_out")
    .lt("nurture_step", 3)
    .eq("nurture_opt_out", false)
    .order("created_at", { ascending: true })
    .limit(400)
    .returns<Row[]>();
  if (error) console.error("[cron/nurture] consulta fallo:", error.message);

  let sent = 0;
  const results: string[] = [];
  for (const user of users ?? []) {
    if (sent >= BATCH) break;
    if (isPro(user) || isCronSkipped(user.email)) continue;
    const { data: first } = await supabase
      .from("reports")
      .select("request_id, created_at, actions, findings, requests!inner(full_name, user_id, origin)")
      .eq("requests.user_id", user.id)
      .eq("requests.origin", "user")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<FirstReport>();
    if (!first) continue;
    const step = dueStep(new Date(first.created_at), user.nurture_step);
    if (!step) continue;
    // Reclamar antes de enviar: un cron solapado no manda dos veces.
    const { data: claimed } = await supabase.from("users").update({ nurture_step: step, nurture_last_at: new Date().toISOString() }).eq("id", user.id).eq("nurture_step", user.nurture_step).select("id").maybeSingle();
    if (!claimed) continue;

    const locale: Locale = isLocale(user.locale) ? user.locale : "es";
    const tr = translator(getMessages(locale));
    const req = Array.isArray(first.requests) ? first.requests[0] : first.requests;
    const name = (req?.full_name ?? "").split(" ")[0] || user.email.split("@")[0];
    try {
      let paragraphs: string[] = [];
      let cta = tr("nurture.ctaReport");
      let path = `/informe/${first.request_id}`;
      if (step === 1) {
        const actions = (first.actions ?? []).slice(0, 3).map((a, i) => `${i + 1}. ${a.title}`);
        paragraphs = [tr("nurture.d1.p1"), ...actions, tr("nurture.d1.p2")];
      } else if (step === 2) {
        const stats = await removalStats(user.id);
        paragraphs = [stats.found > 0 ? tr("nurture.d3.p1Found", { n: stats.found }) : tr("nurture.d3.p1None"), tr("nurture.d3.p2"), tr("nurture.d3.p3")];
        cta = tr("nurture.ctaTools");
        path = "/herramientas";
      } else {
        const stats = await removalStats(user.id);
        const launch = process.env.NEXT_PUBLIC_PRICE_LAUNCH_YEARLY;
        paragraphs = [stats.found > 0 ? tr("nurture.d7.p1Found", { n: stats.found }) : tr("nurture.d7.p1None"), tr("nurture.d7.p2"), launch ? tr("nurture.d7.launch", { price: launch, yearly: prices().yearly }) : tr("nurture.d7.price", { monthly: prices().monthly, yearly: prices().yearly })];
        cta = tr("nurture.ctaPro");
        path = "/pro?ref=email7";
      }
      const url = await createLoginLink(user.email, locale, path);
      await sendNoticeEmail({ to: user.email, subject: tr(`nurture.d${step === 1 ? 1 : step === 2 ? 3 : 7}.subject`), greeting: tr("nurture.greeting", { name }), paragraphs, cta, url, footer: tr("nurture.footer", { stop: stopUrl(user.id) }) });
      void track("nurture_sent", { subject: user.id, locale, props: { step } });
      sent += 1;
      results.push(`${user.id}:${step}`);
    } catch (e) {
      console.error(`[cron/nurture] ${user.id} paso ${step} fallo:`, e);
    }
  }
  console.log(`[cron/nurture] enviados ${sent}`);
  return NextResponse.json({ ok: true, sent, results });
}
