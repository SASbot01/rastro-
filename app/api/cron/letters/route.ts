import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendDeadlineEmail, sendFollowUpNoticeEmail, sendLetterEmail, sendNoticeEmail } from "@/lib/email";
import { buildFollowUp, checkListing, withEvent, type LetterEvent } from "@/lib/letters";
import { applyCheck } from "@/lib/removals";
import { getMessages, translator } from "@/lib/i18n";
import { track } from "@/lib/events";
import { createLoginLink } from "@/lib/login-link";
import { isLocale, type Locale } from "@/lib/i18n";

/**
 * Calendario de plazos. Cron diario, dos pasadas:
 *  1) Recordatorio: cartas enviadas por Rastro hace >= 20 dias sin respuesta
 *     -> segunda solicitud al sitio (con copia al usuario) + aviso al usuario.
 *  0) Recomprobacion: cada semana se vuelve a mirar la URL de cada carta enviada.
 *     Si el dato ya no aparece, se marca como retirado, queda en la cronologia y se avisa.
 *  2) Vencimiento: cartas 'sent' cuyo plazo de un mes ya vencio y aun no se ha
 *     avisado -> correo con enlace a la carta. El estado lo decide la persona.
 * Protegido con Authorization: Bearer CRON_SECRET.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

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
  const rechecks = await recheckLetters(supabase);
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
  return NextResponse.json({ ok: true, due: letters?.length ?? 0, sent, followUps, rechecks });
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


const RECHECK_EVERY_DAYS = 7;
const RECHECK_BATCH = 40;
const RECHECK_PARALLEL = 5;

interface RecheckLetter {
  id: string;
  host: string;
  target_url: string;
  locale: string;
  still_listed: boolean | null;
  removed_at: string | null;
  check_count: number | null;
  events: LetterEvent[] | null;
  users: { email: string } | { email: string }[] | null;
  requests: { full_name: string } | { full_name: string }[] | null;
}

/**
 * Vuelve a mirar las URL de las cartas enviadas (la primera vez sirve de "antes";
 * despues, cada semana). Cuando un dato que aparecia deja de aparecer, se da por
 * retirado, se anota en la cronologia (prueba con fecha) y se avisa a la persona.
 */
async function recheckLetters(supabase: ReturnType<typeof supabaseAdmin>): Promise<{ checked: number; removed: number }> {
  const cutoff = new Date(Date.now() - RECHECK_EVERY_DAYS * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const { data: letters, error } = await supabase
    .from("letters")
    .select("id, host, target_url, locale, still_listed, removed_at, check_count, events, users(email), requests(full_name)")
    .in("status", ["sent", "answered", "no_answer"])
    .in("kind", ["site", "image"])
    .is("removed_at", null)
    .or(`last_check_at.is.null,last_check_at.lt.${cutoff}`)
    .order("last_check_at", { ascending: true, nullsFirst: true })
    .limit(RECHECK_BATCH)
    .returns<RecheckLetter[]>();
  if (error) console.error("[cron/letters] consulta de recomprobacion fallo:", error.message);

  let checked = 0, removed = 0;
  const queue = [...(letters ?? [])];
  async function worker() {
    for (let letter = queue.shift(); letter; letter = queue.shift()) {
      const name = one(letter.requests)?.full_name ?? "";
      if (!name || !/^https?:\/\//i.test(letter.target_url)) continue;
      const result = await checkListing(letter.target_url, name);
      const { patch, justRemoved } = applyCheck(letter, result);
      await supabase.from("letters").update(patch).eq("id", letter.id);
      checked += 1;
      if (!justRemoved) continue;
      removed += 1;
      void track("removal_verified", { subject: letter.id, props: { host: letter.host } });
      const email = one(letter.users)?.email;
      if (!email) continue;
      const locale: Locale = isLocale(letter.locale) ? letter.locale : "es";
      const tr = translator(getMessages(locale));
      try {
        const url = await createLoginLink(email, locale, `/cartas/${letter.id}`);
        await sendNoticeEmail({
          to: email,
          subject: tr("removedEmail.subject", { host: letter.host }),
          greeting: tr("removedEmail.greeting", { name: name.split(" ")[0] }),
          paragraphs: [tr("removedEmail.p1", { host: letter.host }), tr("removedEmail.p2")],
          cta: tr("removedEmail.cta"),
          url,
          footer: tr("removedEmail.footer"),
        });
      } catch (e) {
        console.error(`[cron/letters] aviso de retirada ${letter.id} fallo:`, e);
      }
    }
  }
  await Promise.all(Array.from({ length: RECHECK_PARALLEL }, worker));
  console.log(`[cron/letters] recomprobadas ${checked}, retiradas nuevas ${removed}`);
  return { checked, removed };
}
