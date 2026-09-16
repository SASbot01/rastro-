import { apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const { data } = await supabaseAdmin()
    .from("letters")
    .select("id, kind, provider, host, target_url, contact, status, sent_via, sent_at, deadline_at, follow_up_sent_at, answered_at, outcome, last_check_at, still_listed, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  return apiJson({ count: data?.length ?? 0, letters: (data ?? []).map((l) => ({ ...l, url: `https://rastropro.com/cartas/${l.id}` })) });
}
