import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

/**
 * Chat de la comunidad.
 *   GET  /api/chat?after=<id>   -> mensajes nuevos (o los ultimos 50)
 *   POST /api/chat {body}       -> publica (sesion + alias; 1 mensaje cada 5 s)
 * Los mensajes se guardan 90 dias (purge en el cron de borrado).
 */
export const runtime = "nodejs";

const PAGE = 50;
const MIN_GAP_MS = 5_000;
/** Datos personales que no deben ir a un chat publico: correos y telefonos. */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\s.-]?){9,15}/g;

interface Row { id: number; user_id: string; alias: string; body: string; created_at: string }

export async function GET(request: Request) {
  const after = Number(new URL(request.url).searchParams.get("after") ?? 0);
  const session = await getSession();
  const me = session ? await findUserByEmail(session.email) : null;

  let q = supabaseAdmin().from("community_messages").select("id, user_id, alias, body, created_at").eq("hidden", false);
  q = after > 0 ? q.gt("id", after).order("id", { ascending: true }).limit(PAGE) : q.order("id", { ascending: false }).limit(PAGE);
  const { data } = await q.returns<Row[]>();
  const rows = (data ?? []).sort((a, b) => a.id - b.id).map((m) => ({ id: m.id, alias: m.alias, body: m.body, created_at: m.created_at, mine: me ? m.user_id === me.id : false }));
  return NextResponse.json({ messages: rows, alias: me?.alias ?? null }, { headers: { "cache-control": "no-store" } });
}

const schema = z.object({ body: z.string().trim().min(1).max(500) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "login" }, { status: 401 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.json({ ok: false, error: "login" }, { status: 401 });
  if (!user.alias) return NextResponse.json({ ok: false, error: "community.aliasNeeded" }, { status: 400 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "community.tooLong" }, { status: 400 });

  // Sin correos ni telefonos en un chat publico: se sustituyen, no se bloquea el mensaje.
  const body = parsed.data.body.replace(EMAIL_RE, "[correo]").replace(PHONE_RE, (m) => (m.replace(/\D/g, "").length >= 9 ? "[teléfono]" : m));

  const supabase = supabaseAdmin();
  const { data: last } = await supabase.from("community_messages").select("created_at").eq("user_id", user.id).order("id", { ascending: false }).limit(1).maybeSingle<{ created_at: string }>();
  if (last && Date.now() - new Date(last.created_at).getTime() < MIN_GAP_MS) {
    return NextResponse.json({ ok: false, error: "community.rateLimited" }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("community_messages")
    .insert({ user_id: user.id, alias: user.alias, body })
    .select("id, alias, body, created_at")
    .single<{ id: number; alias: string; body: string; created_at: string }>();
  if (error || !data) return NextResponse.json({ ok: false, error: "formErrors.generic" }, { status: 500 });
  return NextResponse.json({ ok: true, message: { ...data, mine: true } });
}
