import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { hashToken } from "@/lib/crypto";
import { isLocale, type Locale } from "@/lib/i18n";
import { claimAndStart } from "@/lib/verify";
import { setSessionCookie } from "@/lib/session";

/**
 * Enlace de verificacion del informe. Route handler (no pagina) porque aqui
 * se crea la sesion en cookie. Consume el token (un solo uso), crea la cuenta,
 * reclama la solicitud para el job y redirige a la pagina de espera.
 * Estados de error -> /verify/estado?e=invalid|expired
 */
export const runtime = "nodejs";
/** El job del informe corre en `after()` (lib/verify.ts): 90 s es el tope de CLAUDE.md. */
export const maxDuration = 90;

interface Row {
  id: string;
  email: string;
  locale: string;
  status: string;
  verified_at: string | null;
  verify_expires_at: string | null;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const fail = (e: "invalid" | "expired") => NextResponse.redirect(absoluteUrl(`/verify/estado?e=${e}`));
  if (!token) return fail("invalid");

  const { data: row, error } = await supabaseAdmin()
    .from("requests")
    .select("id, email, locale, status, verified_at, verify_expires_at")
    .eq("verify_token", hashToken(token))
    .maybeSingle<Row>();
  if (error) console.error("[/verify] consulta fallo:", error);
  if (!row) return fail("invalid");
  if (!row.verified_at && row.verify_expires_at && new Date(row.verify_expires_at) < new Date()) return fail("expired");

  const locale: Locale = isLocale(row.locale) ? row.locale : "es";
  const result = await claimAndStart(row, locale);
  if (!result.ok) return fail("invalid");

  const res = NextResponse.redirect(absoluteUrl(`/informe/${result.id}`));
  if (result.userId) setSessionCookie(res, row.email);
  return res;
}
