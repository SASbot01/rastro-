import { z } from "zod";
import { apiError, apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { exploitSearchLinks, lookupCve, normCve } from "@/lib/cve-lookup";

/**
 * Buscador de CVE/exploit para el Lab y el MCP. Con { cve } devuelve la ficha
 * de NVD (descripción, CVSS, referencias) y los enlaces a las fuentes públicas
 * de PoC. Con { q } devuelve enlaces de búsqueda por software. Rastro no aloja
 * exploits armados: enlaza a donde ya son públicos. Datos públicos.
 */
export const runtime = "nodejs";
export const maxDuration = 20;
export function OPTIONS() { return preflight(); }

const schema = z.object({ cve: z.string().trim().max(40).optional(), q: z.string().trim().max(120).optional() });

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.cve && !parsed.data.q)) return apiError(400, "invalid_body", "Envía { cve } o { q }.");
  if (parsed.data.cve) {
    if (!normCve(parsed.data.cve)) return apiError(400, "invalid_cve", "Identificador de CVE no válido.");
    const info = await lookupCve(parsed.data.cve);
    return info ? apiJson(info) : apiError(404, "not_found", "No se encontró el CVE.");
  }
  return apiJson(exploitSearchLinks(parsed.data.q!));
}
