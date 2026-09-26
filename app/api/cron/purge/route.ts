import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Borrado automatico a 30 dias (CLAUDE.md s.9). Lo invoca el cron de Vercel
 * (vercel.json) con `Authorization: Bearer $CRON_SECRET`. En un servidor
 * propio, un cron del sistema puede llamar a esta misma URL con esa cabecera.
 * `reports` cae en cascada con `requests`.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const { data, error } = await supabaseAdmin().rpc("purge_expired");
  if (error) {
    console.error("[cron/purge] fallo:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Metricas de embudo: 13 meses bastan para comparar con el año anterior.
  await supabaseAdmin().from("product_events").delete().lt("at", new Date(Date.now() - 400 * 86_400_000).toISOString());

  console.log(`[cron/purge] borradas ${data} solicitudes caducadas`);
  return NextResponse.json({ ok: true, deleted: data });
}
