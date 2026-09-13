import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendDeadlineEmail, sendFollowUpNoticeEmail, sendLetterEmail } from "@/lib/email";
import { buildFollowUp, withEvent, type LetterEvent } from "@/lib/letters";
import { createLoginLink } from "@/lib/login-link";
import { isLocale, type Locale } from "@/lib/i18n";

/**
 * Calendario de plazos. Cron diario, dos pasadas:
 *  1) Recordatorio: cartas enviadas por Rastro hace >= 20 dias sin respuesta
 *     -> segunda solicitud al sitio (con copia al usuario) + aviso al usuario.
 *  2) Vencimiento: cartas 'sent' cuyo plazo de un mes ya vencio y aun no se ha
 *     avisado -> correo con enlace a la carta. El estado lo decide la persona.
 * Protegido con Authorization: Bearer CRON_SECRET.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH = 50;

interface DueLetter {
  id: string;
  host: string;
  sent_at: string;
  deadline_at: string;
  locale: string;
  users: { email: string } | { email: string }[] | null;
  requests: { full_name: string } | { full_name: string }[] | null;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const followUps = await sendFollowUps(supabase);
  const { data: letters, error } = await supabase
    .from("letters")
    .select("id, host, sent_at, deadline_at, locale, users(email), requests(full_name)")
    .eq("status", "sent")
    .is("reminded_at", null)
    .lte("deadline_at", now)
    .order("deadline_at", { ascending: true })
    .limit(BATCH)
    .returns<DueLetter[]>();
  if (error) console.error("[cron/letters] consulta fallo:", error.message);

  let sent = 0;
  for (const letter of letters ?? []) {
    // Reclamar antes de enviar: si el cron se solapa, un solo aviso por carta.
    const { data: claimed } = await supabase
      .from("letters")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", letter.id)
      .is("reminded_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const email = one(letter.users)?.email;
    if (!email) continue;
    const locale: Locale = isLocale(letter.locale) ? letter.locale : "es";
    const name = (one(letter.requests)?.full_name ?? "").split(" ")[0];

    try {
      const letterUrl = await createLoginLink(email, locale, `/cartas/${letter.id}`);
      await sendDeadlineEmail({ to: email, name, host: letter.host, sentAt: letter.sent_at, deadlineAt: letter.deadline_at, letterUrl, locale });
      sent += 1;
    } catch (err) {
      console.error("[cron/letters] aviso fallo:", letter.id, err);
    }
  }

  console.log(`[cron/letters] avisos enviados: ${sent} de ${letters?.length ?? 0}`);
  return NextResponse.json({ ok: true, due: letters?.length ?? 0, sent, followUps });
}

const FOLLOW_UP_DAYS = 20;

interface FollowUpLetter {
  id: string;
  host: string;
  contact: string | null;
  subject: string;
  body: string;
  sent_at: string;
  deadline_at: string;
  locale: string;
  events: LetterEvent[] | null;
  users: { email: string } | { email: string }[] | null;
  requests: { full_name: string } | { full_name: string }[] | null;
}

/** Segunda solicitud automatica para las cartas que envio Rastro y siguen sin respuesta. */
async function sendFollowUps(supabase: ReturnType<typeof supabaseAdmin>): Promise<number> {
  const cutoff = new Date(Date.now() - FOLLOW_UP_DAYS * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const { data: letters, error } = await supabase
    .from("letters")
    .select("id, host, contact, subject, body, sent_at, deadline_at, locale, events, users(email), requests(full_name)")
    .eq("status", "sent")
    .eq("sent_via", "rastro")
    .is("follow_up_sent_at", null)
    .lte("sent_at", cutoff)
    .limit(BATCH)
    .returns<FollowUpLetter[]>();
  if (error) console.error("[cron/letters] consulta de recordatorios fallo:", error.message);

  let count = 0;
  for (const letter of letters ?? []) {
    const to = letter.contact;
    if (!to || !to.includes("@")) continue;
    // Reclamar primero (cron solapado): un recordatorio por carta.
    const { data: claimed } = await supabase.from("letters").update({ follow_up_sent_at: new Date().toISOString() }).eq("id", letter.id).is("follow_up_sent_at", null).select("id").maybeSingle();
    if (!claimed) continue;
    const user = one(letter.users);
    const req = one(letter.requests);
    const locale: Locale = isLocale(letter.locale) ? letter.locale : "es";
    const name = req?.full_name ?? user?.email ?? "";
    try {
      const fu = buildFollowUp({ fullName: name, locale, sentAt: letter.sent_at, deadlineAt: letter.deadline_at, subject: letter.subject, body: letter.body });
      if (user) await sendLetterEmail({ to, user: user.email, subject: fu.subject, body: fu.body });
      await supabase.from("letters").update({ events: withEvent(letter.events, { type: "follow_up", to }) }).eq("id", letter.id);
      if (user) {
        const link = await createLoginLink(user.email, locale, `/cartas/${letter.id}`);
        await sendFollowUpNoticeEmail({ to: user.email, name: name.split(" ")[0] || user.email, host: letter.host, deadlineAt: letter.deadline_at, letterUrl: link, locale });
      }
      count += 1;
    } catch (e) {
      console.error(`[cron/letters] recordatorio ${letter.id} fallo:`, e);
    }
  }
  return count;
}
