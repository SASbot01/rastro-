import { z } from "zod";
import { apiError, apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { allowByKey } from "@/lib/rate-limit";
import { buildDomainReport, cachedDomainReport, saveDomainReport } from "@/lib/domain-report";
import { isValidDomain, normalizeDomain } from "@/lib/domain-report-core";
import { isLocale, type Locale } from "@/lib/i18n";

/**
 * Informe de exposición de un DOMINIO (empresa): correo (SPF/DMARC), web,
 * dominios parecidos y qué dice la IA. Nivel empresa, sin datos personales.
 * Para el MCP de defensa. Cachea 7 días; límite aparte por ser más caro.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export function OPTIONS() { return preflight(); }

const schema = z.object({ domain: z.string().trim().min(4).max(253), refresh: z.boolean().default(false) });

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", "Envía { domain }.");
  const domain = normalizeDomain(parsed.data.domain);
  if (!domain || !isValidDomain(domain)) return apiError(400, "invalid_domain", "Dominio no válido.");
  const locale: Locale = isLocale(auth.user.locale) ? auth.user.locale : "es";

  if (!parsed.data.refresh) {
    const cached = await cachedDomainReport(domain, locale);
    if (cached) return apiJson({ ...cached.report, cached: true });
  }
  if (!(await allowByKey(auth.keyId, "domain_report"))) return apiError(429, "rate_limited", "Límite de informes de dominio alcanzado.");
  const report = await buildDomainReport(domain, locale);
  await saveDomainReport(report, auth.user.id).catch(() => undefined);
  return apiJson({ ...report, cached: false });
}
