import { authenticate, isIdentity, apiError, apiJson, preflight } from "@/lib/api-auth";
import { orgForOwner } from "@/lib/org";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeSentinelEvent, isNotifiable } from "@/lib/sentinel-core";
import { sendNoticeEmail } from "@/lib/email";
import { createLoginLink } from "@/lib/login-link";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";

/**
 * Centinela Rastro (Equipos). La app del cliente (su CRM, etc.) envía eventos de
 * seguridad con la clave `rk_live_` del TITULAR de la empresa. Rastro los guarda
 * y, si son críticos, avisa al titular por correo (como mucho uno por tipo cada
 * hora). No es un IDS: la app decide qué manda y con qué gravedad.
 *
 *   POST /api/v1/sentinel   { kind, severity?, source?, actor?, ip?, country?, message?, meta? }
 *   GET  /api/v1/sentinel   -> últimos 50 eventos del equipo
 */
export const runtime = "nodejs";

export function OPTIONS() {
  return preflight();
}

const ALERT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const id = await authenticate(request);
  if (!isIdentity(id)) return id;
  const { user } = id;
  if (user.plan_kind !== "team") return apiError(403, "team_required", "El Centinela es parte de Rastro Equipos. Usa la clave del titular de la empresa.");
  const org = await orgForOwner(user);
  if (!org) return apiError(403, "no_org", "Esta cuenta no tiene un equipo activo.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "bad_request", "Cuerpo JSON no válido.");
  }
  const ev = normalizeSentinelEvent((body ?? {}) as Record<string, unknown>);
  if (!ev) return apiError(400, "bad_request", "Falta `kind` (tipo de evento).");

  const supabase = supabaseAdmin();
  const { data: row, error } = await supabase
    .from("sentinel_events")
    .insert({ org_id: org.id, ...ev })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) return apiError(500, "server_error", "No se pudo registrar el evento.");

  let alerted = false;
  if (isNotifiable(ev)) {
    // Antiflood: como mucho un aviso por (equipo, tipo) cada hora.
    const since = new Date(Date.now() - ALERT_WINDOW_MS).toISOString();
    const { data: recent } = await supabase
      .from("sentinel_events")
      .select("id")
      .eq("org_id", org.id)
      .eq("kind", ev.kind)
      .eq("alerted", true)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!recent) {
      try {
        const ol: Locale = isLocale(user.locale) ? user.locale : "es";
        const link = await createLoginLink(user.email, ol, "/equipo");
        const detail = [ev.actor, ev.country, ev.message].filter(Boolean).join(" · ") || ev.kind;
        await sendNoticeEmail({
          to: user.email,
          subject: tr(ol, "team.sentinelAlert.subject"),
          greeting: tr(ol, "team.sentinelAlert.greeting"),
          paragraphs: [tr(ol, "team.sentinelAlert.body1", { kind: ev.kind, detail }), tr(ol, "team.sentinelAlert.body2")],
          cta: tr(ol, "team.sentinelAlert.cta"),
          url: link,
          footer: tr(ol, "team.sentinelAlert.footer"),
        });
        if (row) await supabase.from("sentinel_events").update({ alerted: true }).eq("id", row.id);
        alerted = true;
      } catch (e) {
        console.error("[sentinel] aviso al titular falló:", e);
      }
    }
  }
  return apiJson({ ok: true, id: row?.id ?? null, alerted }, { status: 201 });
}

export async function GET(request: Request) {
  const id = await authenticate(request);
  if (!isIdentity(id)) return id;
  const { user } = id;
  if (user.plan_kind !== "team") return apiError(403, "team_required", "El Centinela es parte de Rastro Equipos.");
  const org = await orgForOwner(user);
  if (!org) return apiError(403, "no_org", "Esta cuenta no tiene un equipo activo.");
  const { data } = await supabaseAdmin()
    .from("sentinel_events")
    .select("id, kind, severity, actor, ip, country, message, alerted, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return apiJson({ events: data ?? [] });
}

function tr(locale: Locale, key: string, vars?: Record<string, string | number>) {
  return translator(getMessages(locale))(key, vars);
}
