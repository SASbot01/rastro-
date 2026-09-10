import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

/** Guarda el alias de la comunidad (POST desde /cuenta). Unico, 3-20 caracteres seguros. */
const ALIAS = /^[A-Za-z0-9_-]{3,20}$/;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });

  const alias = String((await request.formData()).get("alias") ?? "").trim();
  if (!ALIAS.test(alias)) return NextResponse.redirect(absoluteUrl("/cuenta?alias=invalid"), { status: 303 });

  const supabase = supabaseAdmin();
  const { data: taken } = await supabase.from("users").select("id").ilike("alias", alias).neq("id", user.id).maybeSingle();
  if (taken) return NextResponse.redirect(absoluteUrl("/cuenta?alias=taken"), { status: 303 });

  const { error } = await supabase.from("users").update({ alias }).eq("id", user.id);
  if (error) console.error("[alias] fallo:", error.message);
  return NextResponse.redirect(absoluteUrl("/cuenta"), { status: 303 });
}
