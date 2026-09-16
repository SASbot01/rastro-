import { apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get("days") ?? 30) || 30));
  const { data } = await supabaseAdmin().from("daily_checks").select("day, breaches, pastes, new_breaches, new_pastes, status").eq("user_id", auth.user.id).order("day", { ascending: false }).limit(days);
  return apiJson({ count: data?.length ?? 0, checks: data ?? [] });
}
