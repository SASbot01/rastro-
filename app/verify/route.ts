import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hashToken } from "@/lib/crypto";
import { isLocale, type Locale } from "@/lib/i18n";
import { runReportJob } from "@/lib/report/job";
import { ensureUser } from "@/lib/users";
import { setSessionCookie } from "@/lib/session";

/**
 * Enlace de verificacion del informe. Route handler (no pagina) porque aqui
 * se crea la sesion en cookie. Consume el token (un solo uso), crea la cuenta,
 * reclama la solicitud para el job y redirige a la pagina de espera.
 * Estados de error -> /verify/estado?e=invalid|expired
 */
export const runtime = "nodejs";
/** El job del informe corre en `after()` dentro de esta ruta: 90 s es el tope de CLAUDE.md. */
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
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const fail = (e: "invalid" | "expired") => NextResponse.redirect(absoluteUrl(`/verify/estado?e=${e}`));
  if (!token) return fail("invalid");

  const supabase = supabaseAdmin();
  const { data: row, error } = await supabase
    .from("requests")
    .select("id, email, locale, status, verified_at, verify_expires_at")
    .eq("verify_token", hashToken(token))
    .maybeSingle<Row>();
  if (error) console.error("[/verify] consulta fallo:", error);
  if (!row) return fail("invalid");

  const locale: Locale = isLocale(row.locale) ? row.locale : "es";

  // Enlace ya usado: sigue siendo del dueno del correo, asi que vuelve al informe con sesion.
  if (row.verified_at) {
    const user = await ensureUser(row.email, locale);
    const res = NextResponse.redirect(absoluteUrl(`/informe/${row.id}`));
    if (user) setSessionCookie(res, row.email);
    return res;
  }

  if (row.verify_expires_at && new Date(row.verify_expires_at) < new Date()) return fail("expired");

  const user = await ensureUser(row.email, locale);
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("requests")
    .update({
      verified_at: now,
      status: "processing",
      started_at: now,
      verify_token: null,
      verify_expires_at: null,
      user_id: user?.id ?? null,
    })
    .eq("id", row.id)
    .eq("status", "pending"); // reclamacion atomica: solo un verify arranca el job
  if (updateError) {
    console.error("[/verify] actualizacion fallo:", updateError);
    return fail("invalid");
  }

  const id = row.id;
  after(() => runReportJob(id));

  const res = NextResponse.redirect(absoluteUrl(`/informe/${id}`));
  if (user) setSessionCookie(res, row.email);
  return res;
}
