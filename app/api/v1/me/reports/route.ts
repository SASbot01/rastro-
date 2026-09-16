import { apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { levelFor } from "@/lib/report/score";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
interface Row { request_id: string; score: number; created_at: string; generator: string; requests: { full_name: string; city: string | null; origin: string } | Array<{ full_name: string; city: string | null; origin: string }> | null }
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const { data } = await supabaseAdmin()
    .from("reports")
    .select("request_id, score, created_at, generator, requests!inner(full_name, city, origin, user_id, status)")
    .eq("requests.user_id", auth.user.id)
    .eq("requests.status", "done")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Row[]>();
  const reports = (data ?? []).map((r) => {
    const q = Array.isArray(r.requests) ? r.requests[0] : r.requests;
    return { id: r.request_id, created_at: r.created_at, score: r.score, level: levelFor(r.score), origin: q?.origin ?? "user", full_name: q?.full_name, city: q?.city ?? null, url: `https://rastropro.com/informe/${r.request_id}` };
  });
  return apiJson({ count: reports.length, reports });
}
