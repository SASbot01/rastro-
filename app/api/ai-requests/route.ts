import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession, sessionOwns } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { AI_PROVIDERS, type AiProviderKey } from "@/lib/ai-providers";
import type { Finding } from "@/lib/report/findings";

/**
 * v4: solicitud de rectificacion/supresion a un proveedor de IA a partir de
 * lo que respondio en el informe (POST: request_id + provider). Crea una carta
 * kind='ai' con la respuesta literal y los datos falsos como anexo, y redirige
 * a /cartas/[id], donde se puede enviar por Rastro si el proveedor acepta correo.
 */
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RawAi { perplexity?: { answers?: Array<{ key: string; answer: string }> }; assistants?: { answers?: Array<{ provider: string; answer: string }> } }

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const form = await request.formData();
  const requestId = String(form.get("request_id") ?? "");
  const provider = String(form.get("provider") ?? "") as AiProviderKey;
  if (!UUID.test(requestId) || !(provider in AI_PROVIDERS)) return new NextResponse(null, { status: 400 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!isPro(user)) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });

  const supabase = supabaseAdmin();
  const { data: req } = await supabase.from("requests").select("id, email, full_name, city, locale").eq("id", requestId).maybeSingle<{ id: string; email: string; full_name: string; city: string | null; locale: string }>();
  if (!req || !sessionOwns(session, req.email)) return new NextResponse(null, { status: 403 });
  const { data: report } = await supabase.from("reports").select("findings, raw").eq("request_id", req.id).maybeSingle<{ findings: Finding[]; raw: RawAi | null }>();
  if (!report) return new NextResponse(null, { status: 404 });

  const { data: existing } = await supabase.from("letters").select("id").eq("user_id", user.id).eq("request_id", req.id).eq("kind", "ai").eq("provider", provider).maybeSingle<{ id: string }>();
  if (existing) return NextResponse.redirect(absoluteUrl(`/cartas/${existing.id}`), { status: 303 });

  const locale: Locale = isLocale(req.locale) ? req.locale : "es";
  const tr = translator(getMessages(locale));
  const p = AI_PROVIDERS[provider];
  const answer =
    provider === "perplexity"
      ? report.raw?.perplexity?.answers?.find((a) => a.key === "who")?.answer
      : report.raw?.assistants?.answers?.find((a) => a.provider === provider)?.answer;
  const falseClaims = (report.findings ?? []).filter((f) => f.category === "false" || (f.category === "ai" && f.severity !== "info")).map((f) => `- ${f.title}`);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date());
  const vars = { name: req.full_name, email: req.email, provider: p.name, date, city: req.city ? `${req.city}, ` : "" };
  const body = [
    tr("aiTpl.date", vars), "",
    tr("aiTpl.salutation", vars), "",
    tr("aiTpl.p1", vars), "",
    tr("aiTpl.p2", vars), "",
    answer ? `«${answer.trim()}»` : tr("aiTpl.noAnswer"), "",
    ...(falseClaims.length ? [tr("aiTpl.p3", vars), ...falseClaims, ""] : []),
    tr("aiTpl.p4", vars), "",
    tr("aiTpl.p5", vars), "",
    tr("aiTpl.p6", vars), "",
    tr("aiTpl.closing", vars), req.full_name,
  ].join("\n");

  const { data: created, error } = await supabase
    .from("letters")
    .insert({ user_id: user.id, request_id: req.id, kind: "ai", provider, host: p.host, target_url: p.url, contact: p.email ?? p.url, contact_source: p.url, subject: tr("aiTpl.subject", vars), body, locale })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) {
    console.error("[/api/ai-requests] insert fallo:", error?.message);
    return new NextResponse(null, { status: 500 });
  }
  return NextResponse.redirect(absoluteUrl(`/cartas/${created.id}`), { status: 303 });
}
