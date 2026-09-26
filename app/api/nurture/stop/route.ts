import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { validStopToken } from "@/lib/nurture";

/** Enlace "no quiero mas correos de estos" de la secuencia. Firmado, sin sesion, idempotente. */
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const u = searchParams.get("u") ?? "";
  const t = searchParams.get("t") ?? "";
  if (!UUID.test(u) || !/^[0-9a-f]{32}$/.test(t) || !validStopToken(u, t)) return new NextResponse(null, { status: 400 });
  await supabaseAdmin().from("users").update({ nurture_opt_out: true }).eq("id", u);
  return NextResponse.redirect(absoluteUrl("/?correos=parados"), { status: 303 });
}
