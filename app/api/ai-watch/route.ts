import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";
import { lastSnapshot, takeWatchSnapshot } from "@/lib/ai-watch";
import { isLocale } from "@/lib/i18n";

/** "Preguntar ahora" desde /ia: una foto nueva de lo que dicen las IA. Pro, una vez al dia. */
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!isPro(user)) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });

  const last = await lastSnapshot(user.id);
  if (last && Date.now() - new Date(last.taken_at).getTime() < 20 * 3_600_000) return NextResponse.redirect(absoluteUrl("/ia?hoy=1"), { status: 303 });

  const { data: req } = await supabaseAdmin().from("requests").select("full_name, city, occupation, locale").eq("user_id", user.id).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle<{ full_name: string; city: string | null; occupation: string | null; locale: string }>();
  if (!req) return NextResponse.redirect(absoluteUrl("/#form"), { status: 303 });
  await takeWatchSnapshot(user.id, req, isLocale(req.locale) ? req.locale : "es");
  return NextResponse.redirect(absoluteUrl("/ia"), { status: 303 });
}
