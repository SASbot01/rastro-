import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isLocale, type Locale } from "@/lib/i18n";
import { allowByKey } from "@/lib/rate-limit";
import { track } from "@/lib/events";
import { canGenerateDomainReport, generateDomainReport } from "@/lib/domain-report";
import { normalizeDomain } from "@/lib/domain-report-core";

/**
 * Genera el informe de exposicion de un dominio (Rastro Equipos). Solo
 * administradores y cuentas con equipo; 10 al dia por cuenta. POST form:
 * domain, locale. Redirige al informe (o al generador con ?e=).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const back = (code: string) => NextResponse.redirect(absoluteUrl(`/equipos/informe?e=${code}`), { status: 303 });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar?next=/equipos/informe"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!canGenerateDomainReport(user, session.email)) return back("forbidden");

  const form = await request.formData().catch(() => null);
  const domain = normalizeDomain(String(form?.get("domain") ?? ""));
  if (!domain) return back("invalid");
  const rawLocale = String(form?.get("locale") ?? "es");
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "es";

  if (!(await allowByKey(user?.id ?? session.email, "domain_report"))) return back("limit");

  try {
    const row = await generateDomainReport(domain, locale, user?.id ?? null);
    void track("domain_report_generated", { subject: user?.id ?? session.email, locale, props: { score: row.score, locale } });
  } catch (e) {
    console.error("[domain-report] fallo al generar:", String(e).slice(0, 200));
    return back("failed");
  }
  return NextResponse.redirect(absoluteUrl(`/equipos/informe/${domain}`), { status: 303 });
}
