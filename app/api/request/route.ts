import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requestSchema, fieldErrors } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase";
import { createVerifyToken, hashIp } from "@/lib/crypto";
import { sendVerifyEmail } from "@/lib/email";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

const TOKEN_TTL_HOURS = 24;

/** Mejor aproximación a la IP del visitante detrás del proxy de Vercel. */
function clientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
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

  const { firstName, lastName, email, city, locale } = parsed.data;
  const fullName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();

  // TODO (Día 5): límite de 3 informes por correo/día y 20 por IP/día usando `rate_limits`.

  const h = await headers();
  const { token, tokenHash } = createVerifyToken();
  const now = new Date();
  const supabase = supabaseAdmin();

  const { data: inserted, error: insertError } = await supabase
    .from("requests")
    .insert({
      email,
      full_name: fullName,
      city: city || null,
      locale,
      consent_at: now.toISOString(),
      status: "pending",
      ip_hash: hashIp(clientIp(h)),
      verify_token: tokenHash,
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
      locale,
    });
  } catch (error) {
    // Sin correo enviado no hay forma de verificar: la fila no sirve para nada.
    console.error("[/api/request] envío falló:", error);
    await supabase.from("requests").delete().eq("id", inserted.id);
    return NextResponse.json({ ok: false, error: "formErrors.generic" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
