import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { STALE_AFTER_MS } from "@/lib/report/job";
import { getSession, sessionOwns } from "@/lib/session";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Estado del informe para la pagina de espera (polling).
 * Nunca devuelve datos personales: solo status, paso y error.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/report/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ status: "not_found" }, { status: 404 });
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "not_found" }, { status: 404, headers: { "cache-control": "no-store" } });

  const supabase = supabaseAdmin();
  const { data: row, error } = await supabase
    .from("requests")
    .select("email, status, step, error, started_at")
    .eq("id", id)
    .eq("email", session.email)
    .maybeSingle();

  if (error || !row || !sessionOwns(session, row.email)) return NextResponse.json({ status: "not_found" }, { status: 404, headers: { "cache-control": "no-store" } });

  // Job muerto (proceso caido a mitad): no dejar al usuario esperando eternamente.
  if (
    row.status === "processing" &&
    row.started_at &&
    Date.now() - new Date(row.started_at).getTime() > STALE_AFTER_MS
  ) {
    await supabase
      .from("requests")
      .update({ status: "error", error: "timeout", finished_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "processing");
    return NextResponse.json({ status: "error", step: null, error: "timeout" });
  }

  return NextResponse.json(
    { status: row.status, step: row.step, error: row.error },
    { headers: { "cache-control": "no-store" } },
  );
}
