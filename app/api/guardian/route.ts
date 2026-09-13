import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";
import { allowByIp } from "@/lib/rate-limit";
import { LOCALES } from "@/lib/i18n";
import { analyzeMessage } from "@/lib/ai/guardian";
import type { KnownAccount } from "@/lib/report/accounts";

/**
 * Guardian (v3): analiza un mensaje sospechoso. Gratis con limite por IP;
 * Pro sin limite y con el contexto del propio informe. El mensaje no se guarda.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ text: z.string().trim().min(10).max(4000), sender: z.string().trim().max(200).optional(), locale: z.enum(LOCALES).default("es") });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "guardian.errors.text" }, { status: 400 });
  const { text, sender, locale } = parsed.data;

  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const pro = isPro(user);
  if (!pro) {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "0.0.0.0";
    if (!(await allowByIp(ip, "guardian"))) return NextResponse.json({ ok: false, error: "guardian.errors.limit" }, { status: 429 });
  }

  // Contexto del ultimo informe (solo con cuenta): cuentas, filtraciones, ciudad, empleo. Nunca el correo.
  let context: { accounts: string[]; breaches: string[]; city: string | null; occupation: string | null } | null = null;
  if (user) {
    const { data } = await supabaseAdmin()
      .from("reports")
      .select("accounts, raw, requests!inner(city, occupation, user_id, status)")
      .eq("requests.user_id", user.id)
      .eq("requests.status", "done")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ accounts: KnownAccount[] | null; raw: { hibp?: { breaches?: Array<{ name: string }> } } | null; requests: { city: string | null; occupation: string | null } | Array<{ city: string | null; occupation: string | null }> | null }>();
    if (data) {
      const req = Array.isArray(data.requests) ? data.requests[0] : data.requests;
      context = {
        accounts: (data.accounts ?? []).map((a) => a.name).slice(0, 25),
        breaches: (data.raw?.hibp?.breaches ?? []).map((b) => b.name).slice(0, 15),
        city: req?.city ?? null,
        occupation: req?.occupation ?? null,
      };
    }
  }

  const result = await analyzeMessage({ locale, text, sender: sender || null, context });
  if (!result.ok) {
    console.error("[/api/guardian] fallo:", result.detail);
    return NextResponse.json({ ok: false, error: "guardian.errors.generic" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, verdict: result.verdict, personalized: Boolean(context) });
}
