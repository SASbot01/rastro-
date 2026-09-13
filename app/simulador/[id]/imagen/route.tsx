import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { maskName } from "@/lib/report/mask";

/** Imagen compartible del simulador: nota de "facilidad para engañarte" y nombre tapado. Nada del contenido. */
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR = { low: "#4dfc5f", medium: "#ffb020", high: "#ff5f5f" } as const;

export async function GET(request: Request, ctx: RouteContext<"/simulador/[id]/imagen">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const story = new URL(request.url).searchParams.get("f") === "story";
  const { data } = await supabaseAdmin()
    .from("simulations")
    .select("content, requests(full_name, locale)")
    .eq("id", id)
    .maybeSingle<{ content: { attackability: number }; requests: { full_name: string; locale: string } | { full_name: string; locale: string }[] | null }>();
  if (!data) return new Response(null, { status: 404 });
  const req = Array.isArray(data.requests) ? data.requests[0] : data.requests;
  const locale: Locale = req && isLocale(req.locale) ? req.locale : "es";
  const tr = translator(getMessages(locale));
  const n = data.content.attackability;
  const level = n < 35 ? "low" : n < 65 ? "medium" : "high";
  const color = COLOR[level];
  const width = story ? 1080 : 1200;
  const height = story ? 1920 : 630;
  const big = story ? 260 : 170;

  return new ImageResponse(
    (
      <div style={{ width, height, display: "flex", flexDirection: story ? "column" : "row", alignItems: "center", justifyContent: "center", gap: story ? 60 : 90, background: "#0a0a0a", color: "#f4f4f2", fontFamily: "Inter, Helvetica, Arial, sans-serif", padding: 80 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: big, fontWeight: 700, color, letterSpacing: "-0.05em", lineHeight: 1 }}>{n}</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: story ? 30 : 22, color: "#6f6f6a", letterSpacing: "0.08em" }}>{tr("sim.attackabilityOutOf").toUpperCase()}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: story ? "center" : "flex-start", textAlign: story ? "center" : "left" }}>
          <div style={{ display: "flex", fontSize: story ? 30 : 22, fontWeight: 700, color: "#4dfc5f", letterSpacing: "0.08em" }}>{tr("sim.attackability").toUpperCase()}</div>
          <div style={{ display: "flex", marginTop: 20, fontSize: story ? 72 : 54, fontWeight: 700, color, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{tr(`sim.attackLevel.${level}`)}</div>
          <div style={{ display: "flex", marginTop: 34, fontSize: story ? 40 : 30, color: "#a3a39e" }}>{maskName(req?.full_name ?? "")}</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: story ? 30 : 22, color: "#6f6f6a" }}>rastropro.com</div>
        </div>
      </div>
    ),
    { width, height },
  );
}
