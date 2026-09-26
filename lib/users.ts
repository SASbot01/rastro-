import { supabaseAdmin } from "@/lib/supabase";
import { normalizeEmail } from "@/lib/crypto";
import type { Locale } from "@/lib/i18n";

import { track } from "@/lib/events";
import { ilikeExact } from "@/lib/like-escape";
/**
 * Cuentas persistentes. Una cuenta = un correo verificado. Se crea sola la
 * primera vez que alguien verifica un enlace; no hay registro aparte.
 */

export interface UserRow {
  id: string;
  email: string;
  locale: string;
  plan: "free" | "pro";
  plan_until: string | null;
  created_at: string;
  monitoring: boolean;
  monitoring_consent_at: string | null;
  monitor_last_at: string | null;
  stripe_customer_id: string | null;
  plan_status: string | null;
  plan_kind: "individual" | "family" | "member" | "team";
  family_owner_id: string | null;
  org_id: string | null;
  org_role: "owner" | "member" | null;
  org_share_at: string | null;
  display_name: string | null;
  avatar: string | null;
}

/** Crea la cuenta si no existe, actualiza last_seen_at y enlaza sus solicitudes antiguas. */
export async function ensureUser(email: string, locale: Locale): Promise<UserRow | null> {
  const supabase = supabaseAdmin();
  const normalized = normalizeEmail(email);

  const { data: user, error } = await supabase
    .from("users")
    .upsert({ email: normalized, locale, last_seen_at: new Date().toISOString() }, { onConflict: "email" })
    .select("id, email, locale, plan, plan_until, created_at, monitoring, monitoring_consent_at, monitor_last_at, stripe_customer_id, plan_status, plan_kind, family_owner_id, org_id, org_role, org_share_at, display_name, avatar")
    .single<UserRow>();
  if (error || !user) {
    console.error("[users] upsert fallo:", error?.message);
    return null;
  }

  if (Date.now() - new Date(user.created_at).getTime() < 10_000) void track("signup", { subject: user.id, locale });

  // Solicitudes hechas antes de tener cuenta (o desde otro dispositivo) pasan a ser suyas.
  // Patron escapado: "_" es un comodin en ILIKE y sin escapar enlazaria solicitudes de OTRO correo (ana_garcia@ ~ ana.garcia@).
  await supabase.from("requests").update({ user_id: user.id }).ilike("email", ilikeExact(normalized)).is("user_id", null);
  return user;
}

/**
 * Cuenta para alguien a quien OTRA persona invita (plan familiar, equipos). A diferencia de ensureUser, no marca
 * `last_seen_at` ni cambia el idioma de una cuenta que ya existe: la persona aun no ha entrado. Con ensureUser el
 * invitado salia como "activo" desde el primer momento (la etiqueta "pendiente/invitado" no aparecia nunca) y se
 * contaba como alta en el embudo.
 */
export async function inviteUser(email: string, locale: Locale): Promise<UserRow | null> {
  const normalized = normalizeEmail(email);
  const existing = await findUserByEmail(normalized);
  if (existing) return existing;
  const { error } = await supabaseAdmin().from("users").insert({ email: normalized, locale });
  // 23505 = otra peticion la acaba de crear: vale igual.
  if (error && error.code !== "23505") {
    console.error("[users] invitacion fallo:", error.message);
    return null;
  }
  return findUserByEmail(normalized);
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { data } = await supabaseAdmin()
    .from("users")
    .select("id, email, locale, plan, plan_until, created_at, monitoring, monitoring_consent_at, monitor_last_at, stripe_customer_id, plan_status, plan_kind, family_owner_id, org_id, org_role, org_share_at, display_name, avatar")
    .eq("email", normalizeEmail(email))
    .maybeSingle<UserRow>();
  return data ?? null;
}
