import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { allowByKey, type RateKind } from "@/lib/rate-limit";
import { isPro } from "@/lib/plan";
import type { UserRow } from "@/lib/users";

/**
 * API publica (v1). Autenticacion por clave `rk_live_...` en
 * `Authorization: Bearer`. Solo se guarda el hash; la clave se ensena una vez.
 * Alcance: los datos de la PROPIA cuenta, catalogos publicos y herramientas
 * (guardian, cartas, puntuacion). Nunca datos de terceros.
 */

export const API_VERSION = "2026-09-16";

export function apiError(status: number, code: string, message: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: cors() });
}

export function apiJson(data: unknown, init?: { status?: number; headers?: Record<string, string> }): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: { ...cors(), "x-rastro-api-version": API_VERSION, ...(init?.headers ?? {}) } });
}

export function cors(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "cache-control": "no-store",
  };
}

export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Genera una clave nueva. Devuelve la clave en claro (mostrar una vez) y su hash. */
export function createApiKey(): { key: string; prefix: string; hash: string } {
  const key = `rk_live_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: hashKey(key) };
}

export interface ApiIdentity { user: UserRow; keyId: string; pro: boolean }

/**
 * Resuelve la clave del Bearer. `ai: true` aplica el limite de peticiones con IA
 * (y exige Pro). Devuelve la identidad o una respuesta de error lista para devolver.
 */
export async function authenticate(request: Request, opts: { ai?: boolean } = {}): Promise<ApiIdentity | NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(rk_live_[A-Za-z0-9_-]{20,})$/.exec(header);
  if (!match) return apiError(401, "unauthorized", "Falta la clave. Envia `Authorization: Bearer rk_live_...` (creala en rastropro.com/cuenta).");
  const supabase = supabaseAdmin();
  const { data: key } = await supabase
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", hashKey(match[1]))
    .maybeSingle<{ id: string; user_id: string; revoked_at: string | null }>();
  if (!key || key.revoked_at) return apiError(401, "unauthorized", "Clave no valida o revocada.");
  const { data: user } = await supabase
    .from("users")
    .select("id, email, locale, plan, plan_until, created_at, monitoring, monitoring_consent_at, monitor_last_at, stripe_customer_id, plan_status, plan_kind, family_owner_id, org_id, org_role, org_share_at, display_name, avatar")
    .eq("id", key.user_id)
    .maybeSingle<UserRow>();
  if (!user) return apiError(401, "unauthorized", "Cuenta no encontrada.");
  const pro = isPro(user);
  if (opts.ai && !pro) return apiError(402, "pro_required", "Este endpoint usa IA y requiere Rastro Pro.");
  if (!(await allowByKey(key.id, opts.ai ? "api_ai" : "api"))) return apiError(429, "rate_limited", opts.ai ? "Limite diario de peticiones con IA alcanzado (100)." : "Limite diario alcanzado (1000).");
  void supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(() => undefined, () => undefined);
  return { user, keyId: key.id, pro };
}

export function isIdentity(x: ApiIdentity | NextResponse): x is ApiIdentity {
  return !(x instanceof NextResponse);
}
