import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { hashToken } from "@/lib/crypto";
import { isLocale } from "@/lib/i18n";
import { ensureUser } from "@/lib/users";
import { setSessionCookie } from "@/lib/session";

/** Consume un enlace de acceso (un solo uso, 24 h), crea la sesion y va a /cuenta. */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const fail = () => NextResponse.redirect(absoluteUrl("/verify/estado?e=login"));
  if (!token) return fail();

  const supabase = supabaseAdmin();
  const { data: row } = await supabase
    .from("login_tokens")
    .select("token_hash, email, locale, expires_at, used_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle<{ token_hash: string; email: string; locale: string; expires_at: string; used_at: string | null }>();

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) return fail();

  // Marcado atomico de "usado": si dos peticiones compiten, solo una entra.
  const { data: claimed } = await supabase
    .from("login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", row.token_hash)
    .is("used_at", null)
    .select("token_hash")
    .maybeSingle();
  if (!claimed) return fail();

  const user = await ensureUser(row.email, isLocale(row.locale) ? row.locale : "es");
  if (!user) return fail();

  // Destino opcional (solo rutas internas): los correos de novedades enlazan al informe.
  const next = url.searchParams.get("next") ?? "";
  const dest = /^\/(?!\/)[\w\-/?=&.]*$/.test(next) ? next : "/cuenta";
  const res = NextResponse.redirect(absoluteUrl(dest));
  setSessionCookie(res, row.email);
  return res;
}
