import { apiError, apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { levelFor } from "@/lib/report/score";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
interface Row { request_id: string; score: number; summary: string; findings: unknown[]; actions: unknown[]; accounts: unknown[]; breakdown: Record<string, number> | null; created_at: string; generator: string; raw: { perplexity?: { answers?: Array<{ key: string; answer: string; sources: unknown[] }> }; assistants?: { answers?: Array<{ provider: string; answer: string; sources: unknown[] }> } } | null }
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const { data } = await supabaseAdmin()
    .from("reports")
    .select("request_id, score, summary, findings, actions, accounts, breakdown, created_at, generator, raw, requests!inner(user_id, status)")
    .eq("requests.user_id", auth.user.id)
    .eq("requests.status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Row>();
  if (!data) return apiError(404, "no_reports", "Esta cuenta aún no tiene informes.");
  const assistants = [
    ...(data.raw?.perplexity?.answers ?? []).filter((a) => a.key === "who").map((a) => ({ provider: "perplexity", answer: a.answer, sources: a.sources })),
    ...(data.raw?.assistants?.answers ?? []).map((a) => ({ provider: a.provider, answer: a.answer, sources: a.sources })),
  ];
  return apiJson({ id: data.request_id, created_at: data.created_at, score: data.score, level: levelFor(data.score), breakdown: data.breakdown ?? {}, summary: data.summary, findings: data.findings, actions: data.actions, accounts: data.accounts, assistants, generator: data.generator, url: `https://rastropro.com/informe/${data.request_id}` });
}
