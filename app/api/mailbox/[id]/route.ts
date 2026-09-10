import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

/** Estado del escaneo del buzon (polling). Solo el dueno. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, ctx: RouteContext<"/api/mailbox/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session || !UUID.test(id)) return NextResponse.json({ status: "not_found" }, { status: 404 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.json({ status: "not_found" }, { status: 404 });

  const { data } = await supabaseAdmin()
    .from("mailbox_scans")
    .select("status, step, messages_seen, messages_total, error, started_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<{ status: string; step: string | null; messages_seen: number; messages_total: number | null; error: string | null; started_at: string }>();
  if (!data) return NextResponse.json({ status: "not_found" }, { status: 404 });
  if (data.status === "processing" && data.started_at && Date.now() - new Date(data.started_at).getTime() > 15 * 60_000) {
    await supabaseAdmin().from("mailbox_scans").update({ status: "error", error: "timeout", finished_at: new Date().toISOString() }).eq("id", id).eq("status", "processing");
    return NextResponse.json({ ...data, status: "error", error: "timeout" });
  }
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
