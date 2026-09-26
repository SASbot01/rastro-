import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { hashCode, normalizeEmail, safeEqual } from "@/lib/crypto";
import { isLocale } from "@/lib/i18n";
import { ensureUser } from "@/lib/users";
import { setSessionCookie } from "@/lib/session";

/**
 * Entrar con el codigo de 6 digitos del correo de acceso (alternativa al
 * enlace). Busca el ultimo token de acceso sin usar del correo, compara el
 * HMAC del codigo, limita intentos y abre sesion.
 */
export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;
const schema = z.object({ email: z.email().trim().toLowerCase(), code: z.string().regex(/^\d{6}$/) });

interface Row {
  token_hash: string;
  email: string;
  locale: string;
  expires_at: string;
  used_at: string | null;
  code_hash: string | null;
  attempts: number;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "formErrors.code" }, { status: 400 });
  const { email, code } = parsed.data;

  const supabase = supabaseAdmin();
  const { data: row } = await supabase
    .from("login_tokens")
    .select("token_hash, email, locale, expires_at, used_at, code_hash, attempts")
    .eq("email", normalizeEmail(email))
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Row>();

  if (!row || !row.code_hash || new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "formErrors.codeExpired" }, { status: 400 });
  }
  if (row.attempts >= MAX_ATTEMPTS) return NextResponse.json({ ok: false, error: "formErrors.codeLocked" }, { status: 429 });

  // El intento se apunta ANTES de comparar y de forma atomica (solo si nadie lo ha apuntado entre medias). Leer,
  // comparar y luego sumar dejaba que muchas peticiones en paralelo leyeran todas "0 intentos" y probaran
  // decenas de codigos con un solo correo de acceso, en vez de 5.
  const attempts = row.attempts + 1;
  const { data: counted } = await supabase
    .from("login_tokens")
    .update({ attempts })
    .eq("token_hash", row.token_hash)
    .eq("attempts", row.attempts)
    .is("used_at", null)
    .select("token_hash")
    .maybeSingle();
  if (!counted) return NextResponse.json({ ok: false, error: "formErrors.code" }, { status: 429 });

  if (!safeEqual(row.code_hash, hashCode(code))) {
    if (attempts >= MAX_ATTEMPTS) await supabase.from("login_tokens").update({ code_hash: null, used_at: new Date().toISOString() }).eq("token_hash", row.token_hash);
    return NextResponse.json(
      { ok: false, error: attempts >= MAX_ATTEMPTS ? "formErrors.codeLocked" : "formErrors.code" },
      { status: attempts >= MAX_ATTEMPTS ? 429 : 400 },
    );
  }

  // Marcado atomico de usado: el enlace y el codigo son la misma credencial.
  const { data: claimed } = await supabase
    .from("login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", row.token_hash)
    .is("used_at", null)
    .select("token_hash")
    .maybeSingle();
  if (!claimed) return NextResponse.json({ ok: false, error: "formErrors.codeExpired" }, { status: 409 });

  const user = await ensureUser(row.email, isLocale(row.locale) ? row.locale : "es");
  if (!user) return NextResponse.json({ ok: false, error: "formErrors.generic" }, { status: 500 });

  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, row.email);
  return res;
}
