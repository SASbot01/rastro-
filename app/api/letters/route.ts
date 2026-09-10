import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession, sessionOwns } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isLocale, type Locale } from "@/lib/i18n";
import { buildLetter, findPrivacyContact } from "@/lib/letters";
import type { Finding } from "@/lib/report/findings";
import { isPro } from "@/lib/plan";

/**
 * Genera una carta de supresion para un hallazgo del informe (formulario
 * POST desde ReportView: request_id + finding_index). Solo el dueno del
 * informe. Redirige a /cartas/[id].
 */
export const runtime = "nodejs";
export const maxDuration = 60; // busqueda del contacto en Perplexity

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/entrar", origin), { status: 303 });

  const form = await request.formData();
  const requestId = String(form.get("request_id") ?? "");
  const index = Number(form.get("finding_index"));
  if (!UUID.test(requestId) || !Number.isInteger(index) || index < 0) return new NextResponse(null, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: req } = await supabase
    .from("requests")
    .select("id, email, full_name, city, locale")
    .eq("id", requestId)
    .maybeSingle<{ id: string; email: string; full_name: string; city: string | null; locale: string }>();
  if (!req || !sessionOwns(session, req.email)) return new NextResponse(null, { status: 403 });

  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(new URL("/entrar", origin), { status: 303 });
  if (!isPro(user)) return NextResponse.redirect(new URL("/pro", origin), { status: 303 });

  const { data: report } = await supabase
    .from("reports")
    .select("findings")
    .eq("request_id", req.id)
    .maybeSingle<{ findings: Finding[] }>();
  const finding = report?.findings?.[index];
  if (!finding?.source_url) return new NextResponse(null, { status: 404 });

  // Una carta por hallazgo: si ya existe, se abre la existente.
  const { data: existing } = await supabase
    .from("letters")
    .select("id")
    .eq("user_id", user.id)
    .eq("request_id", req.id)
    .eq("finding_index", index)
    .maybeSingle<{ id: string }>();
  if (existing) return NextResponse.redirect(new URL(`/cartas/${existing.id}`, origin), { status: 303 });

  const locale: Locale = isLocale(req.locale) ? req.locale : "es";
  let host = "";
  try {
    host = new URL(finding.source_url).hostname.replace(/^www\./, "");
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const [contact, letter] = await Promise.all([
    findPrivacyContact(host, locale).catch(() => null),
    Promise.resolve(buildLetter({ fullName: req.full_name, email: req.email, city: req.city, host, url: finding.source_url, what: finding.title, locale })),
  ]);

  const { data: created, error } = await supabase
    .from("letters")
    .insert({
      user_id: user.id,
      request_id: req.id,
      finding_index: index,
      host,
      target_url: finding.source_url,
      contact: contact?.contact ?? null,
      contact_source: contact?.source ?? null,
      subject: letter.subject,
      body: letter.body,
      locale,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) {
    console.error("[/api/letters] insert fallo:", error?.message);
    return new NextResponse(null, { status: 500 });
  }
  return NextResponse.redirect(new URL(`/cartas/${created.id}`, origin), { status: 303 });
}
