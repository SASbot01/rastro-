import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { createVerifyCode, createVerifyToken, normalizeEmail } from "@/lib/crypto";
import { sendLoginEmail } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { LOCALES } from "@/lib/i18n";
import { allowRequest } from "@/lib/rate-limit";

/**
 * Pide un enlace de acceso. Responde siempre {ok:true} exista o no la cuenta:
 * asi nadie puede usar este formulario para saber quien tiene cuenta.
 */
export const runtime = "nodejs";

const TOKEN_TTL_HOURS = 24;
const schema = z.object({ email: z.email("formErrors.email").trim().toLowerCase(), locale: z.enum(LOCALES).default("es") });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "formErrors.email" }, { status: 400 });
    const { email, locale } = parsed.data;

    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "0.0.0.0";
    if (!(await allowRequest(email, ip, "login"))) {
      return NextResponse.json({ ok: false, error: "formErrors.rateLimit" }, { status: 429 });
    }

    // Entrar y crear cuenta son lo mismo: el correo con codigo crea la cuenta al verificarse.

    const { token, tokenHash } = createVerifyToken();
    const { code, codeHash } = createVerifyCode();
    const { error } = await supabaseAdmin().from("login_tokens").insert({
      token_hash: tokenHash,
      code_hash: codeHash,
      email: normalizeEmail(email),
      locale,
      expires_at: new Date(Date.now() + TOKEN_TTL_HOURS * 3600_000).toISOString(),
    });
    if (error) throw new Error(error.message);

    await sendLoginEmail({ to: email, url: `${serverEnv.siteUrl}/entrar/verificar?token=${token}`, code, locale });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/login] fallo:", error);
    return NextResponse.json({ ok: false, error: "formErrors.generic" }, { status: 500 });
  }
}
