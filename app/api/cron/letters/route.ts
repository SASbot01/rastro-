import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendDeadlineEmail } from "@/lib/email";
import { createLoginLink } from "@/lib/login-link";
import { isLocale, type Locale } from "@/lib/i18n";

/**
 * Calendario de plazos (semana 2). Cron diario: cartas 'sent' cuyo plazo de
 * un mes ya vencio y aun no se ha avisado -> correo con enlace a la carta
 * (abre sesion). El estado no cambia solo: lo decide la persona.
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
  return NextResponse.json({ ok: true, due: letters?.length ?? 0, sent });
}
