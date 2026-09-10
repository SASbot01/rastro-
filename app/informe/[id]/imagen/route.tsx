import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { levelFor } from "@/lib/report/score";
import { maskName } from "@/lib/report/mask";

/**
 * Imagen compartible (CLAUDE.md s.4.4): score, semaforo y nombre tapado.
 * Nunca hallazgos ni datos personales: es lo que la gente sube a redes.
 *   /informe/[id]/imagen           -> 1200x630 (OpenGraph, WhatsApp, X)
 *   /informe/[id]/imagen?f=story   -> 1080x1920 (Instagram/TikTok stories)
 */
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAPER = "#0a0a0a";
const INK = "#f4f4f2";
const MUTED = "#a3a39e";
const FAINT = "#6f6f6a";
const LINE = "#262626";
const ACCENT = "#4dfc5f";
const LEVEL_COLOR = { green: "#4dfc5f", orange: "#ffb020", red: "#ff5f5f" } as const;

export async function GET(request: Request, ctx: RouteContext<"/informe/[id]/imagen">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });

  const story = new URL(request.url).searchParams.get("f") === "story";

  const supabase = supabaseAdmin();
  const { data: req } = await supabase
    .from("requests")
    .select("full_name, locale, status")
    .eq("id", id)
    .maybeSingle<{ full_name: string; locale: string; status: string }>();
  if (!req || req.status !== "done") return new Response(null, { status: 404 });

  const { data: report } = await supabase
    .from("reports")
    .select("score, created_at")
    .eq("request_id", id)
    .maybeSingle<{ score: number; created_at: string }>();
  if (!report) return new Response(null, { status: 404 });

  const locale: Locale = isLocale(req.locale) ? req.locale : "es";
  const tr = translator(getMessages(locale));
  const level = levelFor(report.score);
  const color = LEVEL_COLOR[level];
  const name = maskName(req.full_name);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(report.created_at));

  const width = story ? 1080 : 1200;
  const height = story ? 1920 : 630;
  const ring = story ? 520 : 380;
  const stroke = story ? 34 : 26;
  const r = (ring - stroke) / 2;
  const c = 2 * Math.PI * r;

  const scoreBlock = (
    <div style={{ display: "flex", position: "relative", width: ring, height: ring }}>
      <svg width={ring} height={ring} viewBox={`0 0 ${ring} ${ring}`} style={{ display: "flex", transform: "rotate(-90deg)" }}>
        <circle cx={ring / 2} cy={ring / 2} r={r} fill="none" stroke="#262626" strokeWidth={stroke} />
        <circle
          cx={ring / 2}
          cy={ring / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={`${c * (1 - report.score / 100)}`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: ring,
          height: ring,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", fontSize: story ? 190 : 140, fontWeight: 700, color, letterSpacing: "-0.05em", lineHeight: 1 }}>
          {report.score}
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: story ? 30 : 24, color: FAINT, letterSpacing: "0.08em" }}>
          {tr("og.outOf").toUpperCase()}
        </div>
      </div>
    </div>
  );

  const textBlock = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: story ? "center" : "flex-start", textAlign: story ? "center" : "left" }}>
      <div style={{ display: "flex", fontSize: story ? 30 : 22, fontWeight: 700, color: ACCENT, letterSpacing: "0.08em" }}>
        {tr("og.scoreLabel").toUpperCase()}
      </div>
      <div style={{ display: "flex", marginTop: story ? 24 : 16, fontSize: story ? 72 : 56, fontWeight: 700, color, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
        {tr(`report.level.${level}`)}
      </div>
      <div style={{ display: "flex", marginTop: story ? 40 : 28, fontSize: story ? 40 : 30, color: MUTED }}>{name}</div>
      <div style={{ display: "flex", marginTop: 8, fontSize: story ? 30 : 22, color: FAINT }}>{date}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          padding: story ? 96 : 64,
          fontFamily: "sans-serif",
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: story ? 44 : 30, fontWeight: 700 }}>
          <div style={{ display: "flex", width: story ? 18 : 12, height: story ? 18 : 12, borderRadius: 999, background: ACCENT }} />
          Rastro
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: story ? "column" : "row",
            alignItems: "center",
            justifyContent: story ? "center" : "space-between",
            gap: story ? 72 : 48,
            marginTop: story ? 0 : 24,
          }}
        >
          {story ? scoreBlock : textBlock}
          {story ? textBlock : scoreBlock}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `2px solid ${LINE}`,
            paddingTop: story ? 40 : 24,
            fontSize: story ? 32 : 24,
            color: MUTED,
          }}
        >
          <div>{tr("og.cta")}</div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
