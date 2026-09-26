import { apiError, apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { brokerBySlug } from "@/lib/brokers/catalog";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
export async function GET(request: Request, ctx: RouteContext<"/api/v1/sites/[slug]">) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const { slug } = await ctx.params;
  const b = brokerBySlug(slug);
  if (!b) return apiError(404, "not_found", "Sitio no encontrado.");
  return apiJson({ ...b, url: `https://rastropro.com/sitios/${b.slug}` });
}
