import { NextResponse } from "next/server";
import { z } from "zod";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";
import { sendLetterEmail } from "@/lib/email";
import { withEvent, type LetterEvent } from "@/lib/letters";

import { track } from "@/lib/events";
/**
 * "Enviar por mi": Rastro envia la carta al sitio en nombre del usuario
 * (formulario POST desde /cartas/[id], campo `to`). Reply-to y copia al
 * usuario. Arranca el plazo legal de un mes y la cronologia de la carta.
 */
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schema = z.object({ to: z.email().trim().toLowerCase() });

interface Letter { id: string; status: string; subject: string; body: string; events: LetterEvent[] | null }

export async function POST(request: Request, ctx: RouteContext<"/api/letters/[id]/send">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!isPro(user)) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });

  const form = await request.formData();
  const parsed = schema.safeParse({ to: String(form.get("to") ?? "") });
  if (!parsed.success) return NextResponse.redirect(absoluteUrl(`/cartas/${id}?e=to`), { status: 303 });
  const to = parsed.data.to;
  // Nunca a uno mismo ni a Rastro: evita bucles y pruebas que no son cartas.
  if (to === user.email || to.endsWith("@rastropro.com")) return NextResponse.redirect(absoluteUrl(`/cartas/${id}?e=to`), { status: 303 });

  const supabase = supabaseAdmin();
  const { data: letter } = await supabase.from("letters").select("id, status, subject, body, events").eq("id", id).eq("user_id", user.id).maybeSingle<Letter>();
  if (!letter) return new NextResponse(null, { status: 404 });
  if (letter.status !== "draft") return NextResponse.redirect(absoluteUrl(`/cartas/${id}`), { status: 303 });

  try {
    const { id: messageId } = await sendLetterEmail({ to, user: user.email, subject: letter.subject, body: letter.body });
    void track("letter_sent", { subject: id, props: { via: "rastro" } });
    const now = new Date();
    const deadline = new Date(now);
    deadline.setMonth(deadline.getMonth() + 1); // "un mes" (art. 12.3), no 30 dias
    const { error } = await supabase
      .from("letters")
      .update({
        status: "sent",
        sent_via: "rastro",
        contact: to,
        message_id: messageId,
        sent_at: now.toISOString(),
        deadline_at: deadline.toISOString(),
        answered_at: null,
        reminded_at: null,
        follow_up_sent_at: null,
        events: withEvent(letter.events, { type: "sent_by_rastro", to }),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[/api/letters/send] fallo:", e);
    return NextResponse.redirect(absoluteUrl(`/cartas/${id}?e=send`), { status: 303 });
  }
  return NextResponse.redirect(absoluteUrl(`/cartas/${id}?ok=sent`), { status: 303 });
}
