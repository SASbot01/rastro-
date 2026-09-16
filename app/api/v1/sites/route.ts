import { apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { BROKERS, brokerForHost } from "@/lib/brokers/catalog";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const host = url.searchParams.get("host");
  let list = BROKERS;
  if (kind) list = list.filter((b) => b.kind === kind);
  if (host) { const b = brokerForHost(host); list = b ? [b] : []; }
  return apiJson({ count: list.length, sites: list.map((b) => ({ ...b, url: `https://rastropro.com/sitios/${b.slug}` })) });
}
