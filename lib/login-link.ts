import { supabaseAdmin } from "@/lib/supabase";
import { createVerifyToken, normalizeEmail } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import type { Locale } from "@/lib/i18n";

const TOKEN_TTL_HOURS = 24;

/**
 * Crea un enlace de acceso de un solo uso. Lo usan /api/login y los correos
 * automaticos (novedades mensuales) para que el enlace abra sesion y lleve
 * directamente a `next` (ruta interna).
 */
export async function createLoginLink(email: string, locale: Locale, next?: string): Promise<string> {
  const { token, tokenHash } = createVerifyToken();
  const { error } = await supabaseAdmin().from("login_tokens").insert({
    token_hash: tokenHash,
    email: normalizeEmail(email),
    locale,
    expires_at: new Date(Date.now() + TOKEN_TTL_HOURS * 3600_000).toISOString(),
  });
  if (error) throw new Error(`login_tokens.insert: ${error.message}`);
  const params = new URLSearchParams({ token });
  if (next) params.set("next", next);
  return `${serverEnv.siteUrl}/entrar/verificar?${params}`;
}
