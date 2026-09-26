import { apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const u = auth.user;
  return apiJson({ email: u.email, locale: u.locale, plan: auth.pro ? "pro" : "free", plan_kind: u.plan_kind, plan_until: u.plan_until, monitoring: u.monitoring, monitor_last_at: u.monitor_last_at, created_at: u.created_at });
}
