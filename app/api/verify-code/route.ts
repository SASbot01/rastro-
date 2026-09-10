import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { hashCode, normalizeEmail } from "@/lib/crypto";
import { isLocale, type Locale } from "@/lib/i18n";
import { setSessionCookie } from "@/lib/session";
import { claimAndStart } from "@/lib/verify";

/**
 * Verificacion por codigo de 6 digitos (alternativa al enlace del correo).
 * Busca la ultima solicitud pendiente del correo, compara el HMAC del
 * codigo, limita a MAX_ATTEMPTS intentos y, si acierta, hace lo mismo que
 * /verify: sesion + job. Responde {ok, id} y el cliente va a /informe/[id].
 */
export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_ATTEMPTS = 5;
const schema = z.object({ email: z.email().trim().toLowerCase(), code: z.string().regex(/^\d{6}$/) });

interface Row {
  id: string;
  email: string;
  locale: string;
  status: string;
  verified_at: string | null;
  verify_expires_at: string | null;
  verify_code_hash: string | null;
  verify_attempts: number;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "formErrors.code" }, { status: 400 });
  const { email, code } = parsed.data;

  const supabase = supabaseAdmin();
  const { data: row } = await supabase
    .from("requests")
    .select("id, email, locale, status, verified_at, verify_expires_at, verify_code_hash, verify_attempts")
    .eq("email", normalizeEmail(email))
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Row>();

  if (!row || !row.verify_code_hash || (row.verify_expires_at && new Date(row.verify_expires_at) < new Date())) {
    return NextResponse.json({ ok: false, error: "formErrors.codeExpired" }, { status: 400 });
  }
  if (row.verify_attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ ok: false, error: "formErrors.codeLocked" }, { status: 429 });
  }

  if (row.verify_code_hash !== hashCode(code)) {
    const attempts = row.verify_attempts + 1;
    // Al agotar los intentos, el codigo y el enlace dejan de valer: hay que pedir otro.
    await supabase
      .from("requests")
      .update(attempts >= MAX_ATTEMPTS ? { verify_attempts: attempts, verify_code_hash: null, verify_token: null } : { verify_attempts: attempts })
      .eq("id", row.id);
    return NextResponse.json(
      { ok: false, error: attempts >= MAX_ATTEMPTS ? "formErrors.codeLocked" : "formErrors.code" },
      { status: attempts >= MAX_ATTEMPTS ? 429 : 400 },
    );
  }

  const locale: Locale = isLocale(row.locale) ? row.locale : "es";
  const result = await claimAndStart(row, locale);
  if (!result.ok) return NextResponse.json({ ok: false, error: "formErrors.codeExpired" }, { status: 409 });

  const res = NextResponse.json({ ok: true, id: result.id });
  setSessionCookie(res, row.email);
  return res;
}
