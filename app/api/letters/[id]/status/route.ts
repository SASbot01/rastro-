import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { withEvent, type LetterEvent } from "@/lib/letters";

/**
 * Cambia el estado de una carta (formulario POST desde /cartas/[id]).
 *   sent      -> la envio el usuario: arranca el plazo legal de un mes (art. 12.3 RGPD)
 *   answered  -> con `outcome` (deleted | partial | refused) y `reply_note`; deleted cierra la carta
 *   no_answer / draft
 * Cada cambio queda en la cronologia (events), que luego sirve de prueba.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["draft", "sent", "answered", "no_answer"]);
const OUTCOMES = new Set(["deleted", "partial", "refused"]);

export async function POST(request: Request, ctx: RouteContext<"/api/letters/[id]/status">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });

  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });

  const form = await request.formData();
  const status = String(form.get("status") ?? "");
  if (!STATUSES.has(status)) return new NextResponse(null, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: letter } = await supabase.from("letters").select("events").eq("id", id).eq("user_id", user.id).maybeSingle<{ events: LetterEvent[] | null }>();
  if (!letter) return new NextResponse(null, { status: 404 });

  const now = new Date();
  const patch: Record<string, unknown> = { status };
  let events = letter.events ?? [];
  if (status === "sent") {
    const deadline = new Date(now);
    deadline.setMonth(deadline.getMonth() + 1);
    Object.assign(patch, { sent_via: "user", sent_at: now.toISOString(), deadline_at: deadline.toISOString(), answered_at: null, reminded_at: null, follow_up_sent_at: null });
    events = withEvent(events, { type: "sent" });
  } else if (status === "answered") {
    const outcome = String(form.get("outcome") ?? "");
    const note = String(form.get("reply_note") ?? "").trim().slice(0, 4000);
    if (!OUTCOMES.has(outcome)) return new NextResponse(null, { status: 400 });
    Object.assign(patch, { answered_at: now.toISOString(), outcome, reply_note: note || null });
    if (outcome === "deleted") patch.status = "closed";
    events = withEvent(events, { type: outcome === "deleted" ? "closed" : "answered", note: note || undefined });
  } else if (status === "no_answer") {
    events = withEvent(events, { type: "no_answer" });
  } else if (status === "draft") {
    Object.assign(patch, { sent_via: "user", sent_at: null, deadline_at: null, answered_at: null, reminded_at: null, follow_up_sent_at: null, outcome: null, reply_note: null, message_id: null });
    events = withEvent(events, { type: "reopened" });
  }
  patch.events = events;

  const { error } = await supabase.from("letters").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) console.error("[/api/letters/status] fallo:", error.message);
  return NextResponse.redirect(absoluteUrl(`/cartas/${id}`), { status: 303 });
}
