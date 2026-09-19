import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession, sessionOwns } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { buildLetter, findPrivacyContact } from "@/lib/letters";
import type { Finding } from "@/lib/report/findings";
import { isPro } from "@/lib/plan";
import { brokerForHost } from "@/lib/brokers/catalog";

/**
 * Genera una carta de supresion para un hallazgo del informe (formulario
 * POST desde ReportView: request_id + finding_index). Solo el dueno del
 * informe. Redirige a /cartas/[id].
 */
export const runtime = "nodejs";
export const maxDuration = 60; // busqueda del contacto en Perplexity

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });

  const form = await request.formData();
  const requestId = String(form.get("request_id") ?? "");
  const index = Number(form.get("finding_index"));
  const hostParam = String(form.get("host") ?? "").trim().toLowerCase();
  const scanId = String(form.get("mailbox_scan_id") ?? "");
  const pageUrl = String(form.get("page_url") ?? "").trim();
  const siteSlug = String(form.get("site_slug") ?? "").trim();

  // Modo imagen (v4): carta al sitio que aloja una foto en la que aparece la persona.
  if (pageUrl) return letterForImage(session.email, pageUrl);

  // Modo buzon: carta de cierre para un servicio detectado en el escaneo (sin informe ni hallazgo).
  if (hostParam) return lettersFromMailbox(session.email, hostParam, scanId);

  // Modo sitio comprobado: carta al sitio del catalogo donde el informe vio a la persona.
  if (siteSlug) return letterForSite(session, requestId, siteSlug);

  if (!UUID.test(requestId) || !Number.isInteger(index) || index < 0) return new NextResponse(null, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: req } = await supabase
    .from("requests")
    .select("id, email, full_name, city, locale")
    .eq("id", requestId)
    .maybeSingle<{ id: string; email: string; full_name: string; city: string | null; locale: string }>();
  if (!req || !sessionOwns(session, req.email)) return new NextResponse(null, { status: 403 });

  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!isPro(user)) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });

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
  if (existing) return NextResponse.redirect(absoluteUrl(`/cartas/${existing.id}`), { status: 303 });

  const locale: Locale = isLocale(req.locale) ? req.locale : "es";
  let host = "";
  try {
    host = new URL(finding.source_url).hostname.replace(/^www\./, "");
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // Sitio del catalogo: contacto conocido, sin preguntar a Perplexity.
  const known = brokerForHost(host);
  const [contact, letter] = await Promise.all([
    known && (known.email || known.optOutUrl)
      ? Promise.resolve({ contact: known.email ?? known.optOutUrl!, source: known.privacyUrl ?? known.optOutUrl })
      : findPrivacyContact(host, locale).catch(() => null),
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
  return NextResponse.redirect(absoluteUrl(`/cartas/${created.id}`), { status: 303 });
}

async function lettersFromMailbox(sessionEmail: string, host: string, scanId: string) {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return new NextResponse(null, { status: 400 });
  const user = await findUserByEmail(sessionEmail);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!isPro(user)) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });

  const supabase = supabaseAdmin();
  const { data: scan } = UUID.test(scanId)
    ? await supabase.from("mailbox_scans").select("id, mailbox, services").eq("id", scanId).eq("user_id", user.id).maybeSingle<{ id: string; mailbox: string; services: Array<{ domain: string; name: string }> }>()
    : { data: null };
  const service = scan?.services.find((s) => s.domain === host);
  if (!scan || !service) return new NextResponse(null, { status: 404 });

  const { data: existing } = await supabase
    .from("letters")
    .select("id")
    .eq("user_id", user.id)
    .eq("mailbox_scan_id", scan.id)
    .eq("host", host)
    .maybeSingle<{ id: string }>();
  if (existing) return NextResponse.redirect(absoluteUrl(`/cartas/${existing.id}`), { status: 303 });

  const locale: Locale = isLocale(user.locale) ? user.locale : "es";
  // Nombre: el de la ultima solicitud de la cuenta; si no hay, el correo.
  const { data: last } = await supabase.from("requests").select("full_name, city").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle<{ full_name: string; city: string | null }>();
  const what = locale === "es" ? `una cuenta registrada con el correo ${scan.mailbox} (${service.name})` : `an account registered with the email ${scan.mailbox} (${service.name})`;

  const knownSite = brokerForHost(host);
  const [contact, letter] = await Promise.all([
    knownSite && (knownSite.email || knownSite.optOutUrl)
      ? Promise.resolve({ contact: knownSite.email ?? knownSite.optOutUrl!, source: knownSite.privacyUrl ?? knownSite.optOutUrl })
      : findPrivacyContact(host, locale).catch(() => null),
    Promise.resolve(buildLetter({ fullName: last?.full_name ?? scan.mailbox, email: scan.mailbox, city: last?.city ?? null, host, url: `https://${host}`, what, locale })),
  ]);
  const { data: created, error } = await supabase
    .from("letters")
    .insert({ user_id: user.id, mailbox_scan_id: scan.id, host, target_url: `https://${host}`, contact: contact?.contact ?? null, contact_source: contact?.source ?? null, subject: letter.subject, body: letter.body, locale })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) {
    console.error("[/api/letters] insert (buzon) fallo:", error?.message);
    return new NextResponse(null, { status: 500 });
  }
  return NextResponse.redirect(absoluteUrl(`/cartas/${created.id}`), { status: 303 });
}


async function letterForImage(sessionEmail: string, pageUrl: string) {
  let host = "";
  try {
    const u = new URL(pageUrl);
    if (!/^https?:$/.test(u.protocol)) throw new Error("protocolo");
    host = u.hostname.replace(/^www\./, "");
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const user = await findUserByEmail(sessionEmail);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!isPro(user)) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });
  const supabase = supabaseAdmin();
  const { data: existing } = await supabase.from("letters").select("id").eq("user_id", user.id).eq("kind", "image").eq("target_url", pageUrl).maybeSingle<{ id: string }>();
  if (existing) return NextResponse.redirect(absoluteUrl(`/cartas/${existing.id}`), { status: 303 });

  const locale: Locale = isLocale(user.locale) ? user.locale : "es";
  const tr = translator(getMessages(locale));
  const { data: last } = await supabase.from("requests").select("id, full_name, city, email").eq("user_id", user.id).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle<{ id: string; full_name: string; city: string | null; email: string }>();
  if (!last) return NextResponse.redirect(absoluteUrl("/imagenes?e=noreport"), { status: 303 });
  const known = brokerForHost(host);
  const [contact, letter] = await Promise.all([
    known && (known.email || known.optOutUrl) ? Promise.resolve({ contact: known.email ?? known.optOutUrl!, source: known.privacyUrl ?? known.optOutUrl }) : findPrivacyContact(host, locale).catch(() => null),
    Promise.resolve(buildLetter({ fullName: last.full_name, email: last.email, city: last.city, host, url: pageUrl, what: tr("imageTpl.what", { url: pageUrl }), locale })),
  ]);
  // Anadir el derecho a la propia imagen antes del cierre.
  const body = letter.body.replace(`\n\n${tr("letterTpl.closing")}`, `\n\n${tr("imageTpl.extra")}\n\n${tr("letterTpl.closing")}`);
  const { data: created, error } = await supabase
    .from("letters")
    .insert({ user_id: user.id, request_id: last.id, kind: "image", host, target_url: pageUrl, contact: contact?.contact ?? null, contact_source: contact?.source ?? null, subject: letter.subject, body, locale })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) {
    console.error("[/api/letters] insert (imagen) fallo:", error?.message);
    return new NextResponse(null, { status: 500 });
  }
  return NextResponse.redirect(absoluteUrl(`/cartas/${created.id}`), { status: 303 });
}


async function letterForSite(session: NonNullable<Awaited<ReturnType<typeof getSession>>>, requestId: string, slug: string) {
  if (!UUID.test(requestId) || !/^[a-z0-9-]{2,40}$/.test(slug)) return new NextResponse(null, { status: 400 });
  const supabase = supabaseAdmin();
  const { data: req } = await supabase.from("requests").select("id, email, full_name, city, locale").eq("id", requestId).maybeSingle<{ id: string; email: string; full_name: string; city: string | null; locale: string }>();
  if (!req || !sessionOwns(session, req.email)) return new NextResponse(null, { status: 403 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!isPro(user)) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });

  const { data: report } = await supabase.from("reports").select("site_checks").eq("request_id", req.id).maybeSingle<{ site_checks: Array<{ slug: string; name: string; host: string; status: string; url: string | null }> | null }>();
  const check = report?.site_checks?.find((c) => c.slug === slug && c.status === "listed" && c.url);
  if (!check?.url) return new NextResponse(null, { status: 404 });

  const { data: existing } = await supabase.from("letters").select("id").eq("user_id", user.id).eq("target_url", check.url).maybeSingle<{ id: string }>();
  if (existing) return NextResponse.redirect(absoluteUrl(`/cartas/${existing.id}`), { status: 303 });

  const locale: Locale = isLocale(req.locale) ? req.locale : "es";
  const tr = translator(getMessages(locale));
  const known = brokerForHost(check.host);
  const contact = known && (known.email || known.optOutUrl) ? { contact: known.email ?? known.optOutUrl!, source: known.privacyUrl ?? known.optOutUrl } : await findPrivacyContact(check.host, locale).catch(() => null);
  const letter = buildLetter({ fullName: req.full_name, email: req.email, city: req.city, host: check.host, url: check.url, what: tr("report.sitesWhat", { site: check.name }), locale });
  const { data: created, error } = await supabase
    .from("letters")
    .insert({ user_id: user.id, request_id: req.id, host: check.host, target_url: check.url, contact: contact?.contact ?? null, contact_source: contact?.source ?? null, subject: letter.subject, body: letter.body, locale })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) {
    console.error("[/api/letters] insert (sitio) fallo:", error?.message);
    return new NextResponse(null, { status: 500 });
  }
  return NextResponse.redirect(absoluteUrl(`/cartas/${created.id}`), { status: 303 });
}
