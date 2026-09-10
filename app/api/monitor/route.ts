import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";

/**
 * Activa o desactiva la vigilancia mensual de la cuenta con sesion.
 * Formulario POST desde /cuenta (campo `enabled` = "1" | "0"); vuelve a /cuenta.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/entrar", origin), { status: 303 });

  const form = await request.formData();
  const enabled = form.get("enabled") === "1";

  // Activar es Pro; desactivar siempre se puede.
  if (enabled && !isPro(await findUserByEmail(session.email))) {
    return NextResponse.redirect(new URL("/pro", origin), { status: 303 });
  }

  const { error } = await supabaseAdmin()
    .from("users")
    .update({
      monitoring: enabled,
      monitoring_consent_at: enabled ? new Date().toISOString() : null,
      // Al activar, la primera comprobacion sera dentro de 30 dias (el informe actual ya es reciente).
      ...(enabled ? { monitor_last_at: new Date().toISOString() } : {}),
    })
    .eq("email", session.email);
  if (error) console.error("[/api/monitor] fallo:", error.message);

  return NextResponse.redirect(new URL("/cuenta", origin), { status: 303 });
}
