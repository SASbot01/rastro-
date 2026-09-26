import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";
import { isLocale, type Locale, getMessages, translator } from "@/lib/i18n";
import { buildSimulation, type Simulation } from "@/lib/ai/simulate";
import { sendNoticeEmail, sendSimulatedPhishingEmail } from "@/lib/email";
import type { Finding } from "@/lib/report/findings";
import type { KnownAccount } from "@/lib/report/accounts";

import { track } from "@/lib/events";
/**
 * Simulador (v2). POST con `action`:
 *   generate -> crea (o regenera, solo Pro) la simulacion del ultimo informe
 *   send     -> envia los 3 mensajes simulados al PROPIO correo del usuario (Pro)
 */
export const runtime = "nodejs";
export const maxDuration = 120;

interface LastReport { request_id: string; score: number; summary: string; findings: Finding[]; accounts: KnownAccount[]; requests: { full_name: string; email: string; city: string | null; occupation: string | null; locale: string } | Array<{ full_name: string; email: string; city: string | null; occupation: string | null; locale: string }> | null }

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const action = String((await request.formData()).get("action") ?? "generate");
  const supabase = supabaseAdmin();
  const pro = isPro(user);

  const { data: report } = await supabase
    .from("reports")
    .select("request_id, score, summary, findings, accounts, requests!inner(full_name, email, city, occupation, locale, user_id, status)")
    .eq("requests.user_id", user.id)
    .eq("requests.status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<LastReport>();
  if (!report) return NextResponse.redirect(absoluteUrl("/simulador?e=noreport"), { status: 303 });
  const req = Array.isArray(report.requests) ? report.requests[0] : report.requests;
  if (!req) return NextResponse.redirect(absoluteUrl("/simulador?e=noreport"), { status: 303 });
  const locale: Locale = isLocale(req.locale) ? req.locale : "es";

  const { data: existing } = await supabase.from("simulations").select("id, content, sent_at").eq("user_id", user.id).eq("request_id", report.request_id).maybeSingle<{ id: string; content: Simulation; sent_at: string | null }>();

  if (action === "send") {
    if (!pro || !existing) return NextResponse.redirect(absoluteUrl(pro ? "/simulador" : "/pro"), { status: 303 });
    // Solo al propio correo de la cuenta. Nunca a terceros.
    const tr = translator(getMessages(locale));
    for (const [i, p] of existing.content.phishing.entries()) {
      await sendSimulatedPhishingEmail({ to: user.email, subject: `[${tr("sim.tag")}] ${p.subject}`, fromName: p.from_name, body: p.body, clues: p.clues, index: i + 1, locale });
    }
    await sendNoticeEmail({ to: user.email, subject: tr("sim.sentEmail.subject"), greeting: tr("sim.sentEmail.greeting"), paragraphs: [tr("sim.sentEmail.body")], cta: tr("sim.sentEmail.cta"), url: absoluteUrl("/simulador").toString(), footer: tr("sim.sentEmail.footer") });
    await supabase.from("simulations").update({ sent_at: new Date().toISOString() }).eq("id", existing.id);
    return NextResponse.redirect(absoluteUrl("/simulador?ok=sent"), { status: 303 });
  }

  // generate: gratis una vez por informe; regenerar solo Pro.
  if (existing && !pro) return NextResponse.redirect(absoluteUrl("/simulador"), { status: 303 });
  const result = await buildSimulation({
    locale,
    fullName: req.full_name,
    email: req.email,
    city: req.city,
    occupation: req.occupation,
    score: report.score,
    summary: report.summary,
    findings: report.findings ?? [],
    accounts: report.accounts ?? [],
  });
  if (!result.ok) {
    console.error("[/api/simulate] fallo:", result.detail);
    return NextResponse.redirect(absoluteUrl("/simulador?e=failed"), { status: 303 });
  }
  void track("simulator_used", { subject: user.id });
  const { error } = await supabase.from("simulations").upsert({ user_id: user.id, request_id: report.request_id, content: result.simulation, model: result.model, sent_at: null }, { onConflict: "user_id,request_id" });
  if (error) console.error("[/api/simulate] guardar fallo:", error.message);
  return NextResponse.redirect(absoluteUrl("/simulador"), { status: 303 });
}
