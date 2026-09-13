import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { checkStillListed } from "@/lib/letters";

/** "Comprobar ahora": descarga la pagina de la carta y mira si el nombre sigue apareciendo. Guarda la prueba (fecha + resultado). */
export const runtime = "nodejs";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, ctx: RouteContext<"/api/letters/[id]/check">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });

  const supabase = supabaseAdmin();
  const { data: letter } = await supabase
    .from("letters")
    .select("id, target_url, requests(full_name)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; target_url: string; requests: { full_name: string } | { full_name: string }[] | null }>();
  if (!letter) return new NextResponse(null, { status: 404 });
  const req = Array.isArray(letter.requests) ? letter.requests[0] : letter.requests;
  const name = req?.full_name ?? "";

  const result = await checkStillListed(letter.target_url, name);
  await supabase.from("letters").update({ last_check_at: new Date().toISOString(), still_listed: result }).eq("id", id);
  return NextResponse.redirect(absoluteUrl(`/cartas/${id}`), { status: 303 });
}
