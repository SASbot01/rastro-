import { z } from "zod";
import { apiError, apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { analyzeMessage } from "@/lib/ai/guardian";
import { LOCALES } from "@/lib/i18n";
import { supabaseAdmin } from "@/lib/supabase";
import type { KnownAccount } from "@/lib/report/accounts";
export const runtime = "nodejs";
export const maxDuration = 60;
export function OPTIONS() { return preflight(); }
const schema = z.object({ text: z.string().trim().min(10).max(4000), sender: z.string().trim().max(200).optional(), locale: z.enum(LOCALES).default("es"), personalize: z.boolean().default(false) });
export async function POST(request: Request) {
  const auth = await authenticate(request, { ai: true });
  if (!isIdentity(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", "Cuerpo no válido.", { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  const { text, sender, locale, personalize } = parsed.data;
  let context: { accounts: string[]; breaches: string[]; city: string | null; occupation: string | null } | null = null;
  if (personalize) {
    const { data } = await supabaseAdmin()
      .from("reports")
      .select("accounts, raw, requests!inner(city, occupation, user_id, status)")
      .eq("requests.user_id", auth.user.id)
      .eq("requests.status", "done")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ accounts: KnownAccount[] | null; raw: { hibp?: { breaches?: Array<{ name: string }> } } | null; requests: { city: string | null; occupation: string | null } | Array<{ city: string | null; occupation: string | null }> | null }>();
    if (data) {
      const req = Array.isArray(data.requests) ? data.requests[0] : data.requests;
      context = { accounts: (data.accounts ?? []).map((a) => a.name).slice(0, 25), breaches: (data.raw?.hibp?.breaches ?? []).map((b) => b.name).slice(0, 15), city: req?.city ?? null, occupation: req?.occupation ?? null };
    }
  }
  const result = await analyzeMessage({ locale, text, sender: sender || null, context });
  if (!result.ok) return apiError(502, "analysis_failed", "No se pudo analizar el mensaje ahora mismo.");
  return apiJson({ ...result.verdict, personalized: Boolean(context) });
}
