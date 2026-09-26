import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requestSchema, fieldErrors } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase";
import { createVerifyCode, createVerifyToken, hashIp } from "@/lib/crypto";
import { sendVerifyEmail } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { allowRequest } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";

import { track } from "@/lib/events";
export const runtime = "nodejs";

const TOKEN_TTL_HOURS = 24;

/** IP del visitante (ver lib/client-ip.ts: detras de Cloudflare manda CF-Connecting-IP). */
function clientIp(h: Headers): string {
  return clientIpFrom(h);
}

export async function POST(request: Request) {
  try {
    return await handleRequest(request);
  } catch (error) {
    // Config incompleta (.env.local a medias) o fallo inesperado: el cliente
    // siempre recibe la forma que espera, nunca un 500 vacio.
    console.error("[/api/request] error no controlado:", error);
    return NextResponse.json({ ok: false, error: "formErrors.generic" }, { status: 500 });
  }
}

async function handleRequest(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "formErrors.generic" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "formErrors.generic", fields: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const { firstName, lastName, email, city, occupation, locale } = parsed.data;
  const ref = parsed.data.ref ? parsed.data.ref.toLowerCase() : null;
  const fullName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();

  const h = await headers();
  const ip = clientIp(h);

  // 3 informes por correo y dia, 20 por IP (CLAUDE.md s.4). Se cuenta antes de
  // insertar para que un abuso no llene la tabla ni dispare correos.
  if (!(await allowRequest(email, ip))) {
    return NextResponse.json({ ok: false, error: "formErrors.rateLimit" }, { status: 429 });
  }
  const { token, tokenHash } = createVerifyToken();
  const { code, codeHash } = createVerifyCode();
  const now = new Date();
  const supabase = supabaseAdmin();

  const { data: inserted, error: insertError } = await supabase
    .from("requests")
    .insert({
      email,
      full_name: fullName,
      city: city || null,
      occupation: occupation || null,
      locale,
      ref,
      consent_at: now.toISOString(),
      status: "pending",
      ip_hash: hashIp(ip),
      verify_token: tokenHash,
      verify_code_hash: codeHash,
      verify_attempts: 0,
      verify_expires_at: new Date(now.getTime() + TOKEN_TTL_HOURS * 3600_000).toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[/api/request] insert falló:", insertError);
    return NextResponse.json({ ok: false, error: "formErrors.generic" }, { status: 500 });
  }

  try {
    await sendVerifyEmail({
      to: email,
      name: firstName,
      url: `${serverEnv.siteUrl}/verify?token=${token}`,
      code,
      locale,
    });
  } catch (error) {
    // Sin correo enviado no hay forma de verificar: la fila no sirve para nada.
    console.error("[/api/request] envío falló:", error);
    await supabase.from("requests").delete().eq("id", inserted.id);
    return NextResponse.json({ ok: false, error: "formErrors.generic" }, { status: 502 });
  }

  void track("form_submitted", { subject: inserted.id, locale, props: { has_occupation: Boolean(occupation), ref: ref ?? "directo" } });
  return NextResponse.json({ ok: true });
}
