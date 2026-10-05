import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { createApiKey } from "@/lib/api-auth";

/** Claves de API (formulario POST desde /cuenta): action=create (name) | revoke (id). La clave se ensena una sola vez via query. */
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_KEYS = 5;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const supabase = supabaseAdmin();
  if (action === "revoke") {
    const id = String(form.get("id") ?? "");
    if (UUID.test(id)) await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    return NextResponse.redirect(absoluteUrl("/cuenta#api"), { status: 303 });
  }
  const { count } = await supabase.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("revoked_at", null);
  if ((count ?? 0) >= MAX_KEYS) return NextResponse.redirect(absoluteUrl("/cuenta?api=full#api"), { status: 303 });
  const name = String(form.get("name") ?? "").trim().slice(0, 60) || "default";
  const { key, prefix, hash } = createApiKey();
  const { error } = await supabase.from("api_keys").insert({ user_id: user.id, name, prefix, key_hash: hash });
  if (error) return NextResponse.redirect(absoluteUrl("/cuenta?api=error#api"), { status: 303 });
  // La clave viaja una vez en la URL de vuelta (misma sesion, HTTPS) y se muestra para copiar.
  return NextResponse.redirect(absoluteUrl(`/cuenta?newkey=${encodeURIComponent(key)}#api`), { status: 303 });
}
