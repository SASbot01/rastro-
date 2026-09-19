import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { checkListing, type LetterEvent } from "@/lib/letters";
import { applyCheck } from "@/lib/removals";

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
    .select("id, target_url, still_listed, removed_at, check_count, events, requests(full_name)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; target_url: string; still_listed: boolean | null; removed_at: string | null; check_count: number | null; events: LetterEvent[] | null; requests: { full_name: string } | { full_name: string }[] | null }>();
  if (!letter) return new NextResponse(null, { status: 404 });
  const req = Array.isArray(letter.requests) ? letter.requests[0] : letter.requests;
  const name = req?.full_name ?? "";

  const result = await checkListing(letter.target_url, name);
  const { patch } = applyCheck(letter, result);
  // Comprobacion manual: si no se pudo leer la pagina, que se vea "no se pudo comprobar" y no el resultado viejo.
  if (result.listed === null) patch.still_listed = null;
  await supabase.from("letters").update(patch).eq("id", id);
  return NextResponse.redirect(absoluteUrl(`/cartas/${id}`), { status: 303 });
}
