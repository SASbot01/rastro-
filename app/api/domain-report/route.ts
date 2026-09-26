import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { absoluteUrl } from "@/lib/env";
import { getMessages, isLocale, t, type Locale } from "@/lib/i18n";
import { allowRequest } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";
import { track } from "@/lib/events";
import { sendSupportEmail } from "@/lib/email";
import { normalizeDomain } from "@/lib/domain-report-core";

/**
 * "Pide tu informe" de dominio (interes comercial de Rastro Equipos). Solo se
 * apunta el evento (dominio + hash del correo, sin mas datos) y se avisa al
 * equipo por el canal de soporte. POST form: domain, email, locale.
 */
export const runtime = "nodejs";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200), domain: z.string().trim().max(260), locale: z.string().optional() });

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const parsed = schema.safeParse({ email: form?.get("email") ?? "", domain: form?.get("domain") ?? "", locale: form?.get("locale") ?? undefined });
  const domain = parsed.success ? normalizeDomain(parsed.data.domain) : null;
  if (!parsed.success || !domain) return NextResponse.redirect(absoluteUrl("/equipos/informe?e=invalid"), { status: 303 });
  const locale: Locale = isLocale(parsed.data.locale) ? parsed.data.locale : "es";

  const ip = clientIpFrom(await headers());
  if (!(await allowRequest(parsed.data.email, ip, "support"))) return NextResponse.redirect(absoluteUrl("/equipos/informe?e=limit"), { status: 303 });

  void track("domain_report_requested", { subject: parsed.data.email, locale, props: { domain, locale } });
  try {
    await sendSupportEmail({ from: parsed.data.email, subject: `Informe de dominio: ${domain}`, message: t(getMessages("es"), "domainReport.request.notice", { domain }), locale, page: `/equipos/informe/${domain}` });
  } catch (e) {
    console.error("[domain-report] aviso no enviado:", String(e).slice(0, 160));
  }
  return NextResponse.redirect(absoluteUrl(`/equipos/informe/${domain}?pedido=1`), { status: 303 });
}
