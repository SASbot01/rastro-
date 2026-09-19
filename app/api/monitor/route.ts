import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";

import { track } from "@/lib/events";
/**
 * Activa o desactiva la vigilancia mensual de la cuenta con sesion.
 * Formulario POST desde /herramientas (campo `enabled` = "1" | "0").
 * Al activar vuelve al perfil, que estrena el calendario con animacion.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });

  const form = await request.formData();
  const enabled = form.get("enabled") === "1";

  // Activar es Pro; desactivar siempre se puede.
  if (enabled && !isPro(await findUserByEmail(session.email))) {
    return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });
  }

  if (enabled) void track("monitoring_on", {});
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

  return NextResponse.redirect(absoluteUrl(enabled ? "/cuenta?vigilancia=on" : "/herramientas"), { status: 303 });
}
