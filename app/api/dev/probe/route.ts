import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { getBreaches } from "@/lib/hibp";
import { searchName } from "@/lib/brave";
import { isLocale } from "@/lib/i18n";
import { checkSites } from "@/lib/site-checks";
import { runReportJob } from "@/lib/report/job";

/**
 * SOLO DESARROLLO. Ejecuta los clientes de datos sin tocar la BD para
 * comprobar claves y formas de respuesta:
 *   /api/dev/probe?email=a@b.com&name=Nombre%20Apellido&city=Valencia
 *   &sites=1  comprueba tambien los sitios del catalogo
 *   ?job=<request_id>  ejecuta el job de un informe ya en 'processing'
 * En produccion responde 404.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (serverEnv.isProduction) return new NextResponse(null, { status: 404 });

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const name = searchParams.get("name");
  const city = searchParams.get("city");
  const occupation = searchParams.get("occupation");
  const localeParam = searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : "es";

  const started = Date.now();
  const job = searchParams.get("job");
  if (job) { await runReportJob(job); return NextResponse.json({ ms: Date.now() - started, job }); }
  if (name && searchParams.get("sites")) { const r = await checkSites({ fullName: name, locale }); return NextResponse.json({ ms: Date.now() - started, queries: r.queries, checks: r.checks }); }
  const [hibp, brave] = await Promise.all([
    email ? getBreaches(email) : Promise.resolve(null),
    name ? searchName({ fullName: name, city, occupation, locale }) : Promise.resolve(null),
  ]);

  // Sin `raw` en la salida: solo lo que el pipeline usara de verdad.
  return NextResponse.json({
    ms: Date.now() - started,
    hibp: hibp && (hibp.checked ? { checked: true, breaches: hibp.breaches } : hibp),
    brave: brave && (brave.ok ? { ok: true, query: brave.query, hits: brave.hits } : brave),
  });
}
