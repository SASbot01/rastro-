import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";
import { lastSnapshot, takeWatchSnapshot } from "@/lib/ai-watch";
import { allowByKey } from "@/lib/rate-limit";
import { isLocale } from "@/lib/i18n";

/** "Preguntar ahora" desde /ia: una foto nueva de lo que dicen las IA. Pro, una vez al dia. */
export const runtime = "nodejs";
export const maxDuration = 120;

const ONCE_EVERY_MS = 20 * 3_600_000;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!isPro(user)) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });
  const today = () => NextResponse.redirect(absoluteUrl("/ia?hoy=1"), { status: 303 });

  const last = await lastSnapshot(user.id);
  if (last && Date.now() - new Date(last.taken_at).getTime() < ONCE_EVERY_MS) return today();

  const supabase = supabaseAdmin();
  const { data: req } = await supabase.from("requests").select("full_name, city, occupation, locale").eq("user_id", user.id).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle<{ full_name: string; city: string | null; occupation: string | null; locale: string }>();
  if (!req) return NextResponse.redirect(absoluteUrl("/#form"), { status: 303 });

  // El limite no puede depender de que la foto se guarde: si la ficha falla no hay foto, y cada clic volvia a
  // preguntar a todas las IA (coste real). Tope duro de intentos al dia, pase lo que pase.
  if (!(await allowByKey(user.id, "ai_watch"))) return today();
  // Reclamar el turno de forma atomica (doble clic = una sola pregunta). Es la misma marca que usa el cron semanal,
  // asi que la cuenta demo (marca en 2099) tampoco se toca desde aqui.
  const { data: mark } = await supabase.from("users").select("ai_watch_last_at").eq("id", user.id).maybeSingle<{ ai_watch_last_at: string | null }>();
  const before = mark?.ai_watch_last_at ?? null;
  const cutoff = new Date(Date.now() - ONCE_EVERY_MS).toISOString();
  const claim = supabase.from("users").update({ ai_watch_last_at: new Date().toISOString() }).eq("id", user.id);
  const { data: claimed } = await (before === null ? claim.is("ai_watch_last_at", null) : claim.lt("ai_watch_last_at", cutoff)).select("id").maybeSingle();
  if (!claimed) return today();

  const snap = await takeWatchSnapshot(user.id, req, isLocale(req.locale) ? req.locale : "es");
  // Sin foto (IA caidas): se devuelve la marca para que el cron semanal lo intente cuando tocaba.
  if (!snap) await supabase.from("users").update({ ai_watch_last_at: before }).eq("id", user.id);
  return NextResponse.redirect(absoluteUrl("/ia"), { status: 303 });
}
