import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/** Salud de la app: responde 200 si el proceso vive y la base de datos contesta. Lo usan el watchdog del servidor y el monitor externo. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const { error } = await supabaseAdmin().from("users").select("id", { count: "exact", head: true }).limit(1);
  const db = !error;
  return NextResponse.json({ ok: db, db, ms: Date.now() - started, at: new Date().toISOString() }, { status: db ? 200 : 503, headers: { "cache-control": "no-store" } });
}
