import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureUser, type UserRow } from "@/lib/users";
import { normalizeEmail } from "@/lib/crypto";
import type { Locale } from "@/lib/i18n";

/**
 * Stripe (plan Pro). Solo se usa desde el servidor: webhook y portal.
 * La suscripcion manda: cada evento de Stripe se traduce a plan/plan_until.
 */

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY");
  if (!client) client = new Stripe(key);
  return client;
}

/** Fin del periodo pagado: en versiones recientes de la API vive en el item. */
function periodEnd(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const ts = item?.current_period_end ?? legacy;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

const ACTIVE = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);

/**
 * La cuenta de Stripe se comparte con otros productos: solo cuentan las
 * suscripciones cuyo precio esta en STRIPE_PRICE_IDS (los dos de Rastro Pro).
 * Sin la variable, se acepta todo (util en pruebas con cuenta propia).
 */
export function isRastroSubscription(sub: Stripe.Subscription): boolean {
  const allowed = (process.env.STRIPE_PRICE_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  return (sub.items?.data ?? []).some((it) => allowed.includes(it.price?.id ?? ""));
}

/** Precios del plan familiar (STRIPE_PRICE_IDS_FAMILY). Si la suscripcion lleva uno, el titular es 'family'. */
function isFamilySubscription(sub: Stripe.Subscription): boolean {
  const fam = (process.env.STRIPE_PRICE_IDS_FAMILY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return fam.length > 0 && (sub.items?.data ?? []).some((it) => fam.includes(it.price?.id ?? ""));
}

/** Precios de Rastro Equipos: STRIPE_PRICE_IDS_TEAM (pequeno) y STRIPE_PRICE_IDS_TEAM_LARGE. Devuelve las plazas. */
function teamSeatsFor(sub: Stripe.Subscription): number | null {
  const ids = (sub.items?.data ?? []).map((it) => it.price?.id ?? "");
  const small = (process.env.STRIPE_PRICE_IDS_TEAM ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const large = (process.env.STRIPE_PRICE_IDS_TEAM_LARGE ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.some((id) => large.includes(id))) return Number(process.env.NEXT_PUBLIC_TEAM_SEATS_LARGE || 25);
  if (ids.some((id) => small.includes(id))) return Number(process.env.NEXT_PUBLIC_TEAM_SEATS || 10);
  return null;
}

/** Aplica el estado de una suscripcion a la cuenta (por id de usuario o por correo del cliente). */
export async function syncSubscription(sub: Stripe.Subscription, hint: { userId?: string | null; email?: string | null; locale?: Locale }): Promise<void> {
  if (!isRastroSubscription(sub)) {
    console.log(`[stripe] ignorada suscripcion de otro producto: ${sub.id}`);
    return;
  }
  const supabase = supabaseAdmin();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // 1) por id de cuenta (client_reference_id), 2) por cliente de Stripe ya conocido, 3) por correo (crea cuenta si hace falta)
  let user: Pick<UserRow, "id"> | null = null;
  if (hint.userId) {
    const { data } = await supabase.from("users").select("id").eq("id", hint.userId).maybeSingle<{ id: string }>();
    user = data;
  }
  if (!user) {
    const { data } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).maybeSingle<{ id: string }>();
    user = data;
  }
  if (!user && hint.email) user = await ensureUser(normalizeEmail(hint.email), hint.locale ?? "es");
  if (!user) {
    console.error("[stripe] suscripcion sin cuenta asociable:", sub.id, customerId);
    return;
  }

  const active = ACTIVE.has(sub.status);
  const family = isFamilySubscription(sub);
  const teamSeats = teamSeatsFor(sub);
  const patch = {
    // 'canceling' = sigue activa hasta el fin del periodo, pero no renovara.
    plan_status: sub.cancel_at_period_end && active ? "canceling" : sub.status,
    plan: active ? "pro" : "free",
    // Si cancela, Pro sigue hasta el fin del periodo pagado (isPro lo comprueba).
    plan_until: active || sub.cancel_at_period_end ? periodEnd(sub) : null,
  };
  const { error } = await supabase
    .from("users")
    .update({ stripe_customer_id: customerId, stripe_subscription_id: sub.id, plan_kind: teamSeats ? "team" : family ? "family" : "individual", ...patch })
    .eq("id", user.id);
  // Equipos: crear la organizacion la primera vez y ajustar plazas; los miembros siguen al titular.
  if (teamSeats) {
    const { data: org } = await supabase.from("orgs").select("id").eq("owner_user_id", user.id).maybeSingle<{ id: string }>();
    if (org) await supabase.from("orgs").update({ seats: teamSeats }).eq("id", org.id);
    else {
      const { data: created } = await supabase.from("orgs").insert({ name: hint.email?.split("@")[1] ?? "Equipo", owner_user_id: user.id, seats: teamSeats }).select("id").single<{ id: string }>();
      if (created) await supabase.from("users").update({ org_id: created.id, org_role: "owner" }).eq("id", user.id);
    }
    const { data: org2 } = await supabase.from("orgs").select("id").eq("owner_user_id", user.id).maybeSingle<{ id: string }>();
    if (org2) await supabase.from("users").update(patch).eq("org_id", org2.id).eq("org_role", "member");
  }
  if (error) console.error("[stripe] users.update fallo:", error.message);
  else console.log(`[stripe] usuario ${user.id}: ${sub.status} -> plan ${active ? "pro" : "free"}${family ? " (familiar)" : ""}`);

  // Los miembros del plan familiar siguen la suerte del titular (renovacion, cancelacion, impago).
  const { error: memberError } = await supabase.from("users").update(patch).eq("family_owner_id", user.id).eq("plan_kind", "member");
  if (memberError) console.error("[stripe] miembros.update fallo:", memberError.message);
}
