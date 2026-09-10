import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

/**
 * Cambia el estado de una carta (formulario POST desde /cartas/[id]).
 *   sent      -> arranca el plazo legal de un mes (art. 12.3 RGPD)
 *   answered / no_answer / draft
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["draft", "sent", "answered", "no_answer"]);

export async function POST(request: Request, ctx: RouteContext<"/api/letters/[id]/status">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });

  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });

  const status = String((await request.formData()).get("status") ?? "");
  if (!STATUSES.has(status)) return new NextResponse(null, { status: 400 });

  const now = new Date();
  const patch: Record<string, unknown> = { status };
  if (status === "sent") {
    const deadline = new Date(now);
    deadline.setMonth(deadline.getMonth() + 1); // "un mes", no 30 dias
    Object.assign(patch, { sent_at: now.toISOString(), deadline_at: deadline.toISOString(), answered_at: null, reminded_at: null });
  } else if (status === "answered") {
    patch.answered_at = now.toISOString();
  } else if (status === "draft") {
    Object.assign(patch, { sent_at: null, deadline_at: null, answered_at: null, reminded_at: null });
  }

  const { error } = await supabaseAdmin().from("letters").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) console.error("[/api/letters/status] fallo:", error.message);
  return NextResponse.redirect(absoluteUrl(`/cartas/${id}`), { status: 303 });
}
