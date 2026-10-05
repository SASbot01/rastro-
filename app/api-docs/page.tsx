import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { API_SPEC } from "@/lib/api-spec";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `${tr("api.title")} — Rastro`, description: tr("api.subtitle"), alternates: { canonical: "/api-docs" } };
}

const CURL = `curl -s https://rastropro.com/api/v1/sites?host=dateas.com \\
  -H "Authorization: Bearer rk_live_TU_CLAVE"`;
const PY = `import requests
H = {"Authorization": "Bearer rk_live_TU_CLAVE"}
r = requests.post("https://rastropro.com/api/v1/letters/draft", headers=H, json={
    "fullName": "Ana García Ruiz", "email": "ana@ejemplo.com", "city": "Valencia",
    "url": "https://www.dateas.com/es/persona/ana-garcia-ruiz-valencia",
    "what": "mi nombre, provincia y edad"})
print(r.json()["subject"]); print(r.json()["contact"])`;
const JS = `const res = await fetch("https://rastropro.com/api/v1/guardian", {
  method: "POST",
  headers: { Authorization: "Bearer rk_live_TU_CLAVE", "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Tu paquete está retenido, paga 1,99 € aquí: http://correos-es.top/x", personalize: true }),
});
const { verdict, confidence, reasons } = await res.json();`;

/** Documentacion publica de la API, generada del OpenAPI. */
export default async function ApiDocsPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const paths = Object.entries(API_SPEC.paths) as Array<[string, Record<string, { summary: string; description?: string }>]>;
  const CARD = "card p-5 sm:p-6";
  const PRE = "mt-2 overflow-x-auto rounded-[12px] bg-paper p-4 font-mono text-[12.5px] leading-relaxed text-ink";

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-10 sm:py-14">
        <p className="eyebrow">{tr("api.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("api.title")}</h1>
        <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-muted">{tr("api.subtitle")}</p>
        <p className="mt-3 max-w-[62ch] rounded-[12px] border border-accent/40 bg-accent-soft px-4 py-3 text-[14px] leading-relaxed text-ink">{tr("api.principle")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/cuenta#api" className="btn btn-primary">{tr("api.getKey")}</Link>
          <a href="/api/v1/openapi.json" className="btn btn-secondary">{tr("api.openapi")}</a>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section className={CARD}><h2 className="text-[16px] font-semibold text-ink">{tr("api.auth")}</h2><p className="mt-2 text-[14px] leading-relaxed text-muted">{tr("api.authBody")}</p></section>
          <section className={CARD}><h2 className="text-[16px] font-semibold text-ink">{tr("api.limits")}</h2><p className="mt-2 text-[14px] leading-relaxed text-muted">{tr("api.limitsBody")}</p></section>
        </div>

        <h2 className="mt-10 text-[20px] font-semibold tracking-[-0.02em] text-ink">{tr("api.endpoints")}</h2>
        <ul className="mt-4 grid gap-2">
          {paths.map(([path, methods]) =>
            Object.entries(methods).map(([method, op]) => (
              <li key={method + path} className="card px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={"rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold uppercase " + (method === "get" ? "bg-accent-soft text-accent" : "bg-warn/15 text-warn")}>{method}</span>
                  <code className="font-mono text-[13.5px] text-ink">/api/v1{path}</code>
                </div>
                <p className="mt-1.5 text-[14px] font-medium text-ink">{op.summary}</p>
                {op.description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{op.description}</p>}
              </li>
            )),
          )}
        </ul>

        <h2 className="mt-10 text-[20px] font-semibold tracking-[-0.02em] text-ink">{tr("api.examples")}</h2>
        <div className="mt-4 grid gap-4">
          <section className={CARD}><h3 className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted">{tr("api.curl")}</h3><pre className={PRE}>{CURL}</pre></section>
          <section className={CARD}><h3 className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted">{tr("api.python")}</h3><pre className={PRE}>{PY}</pre></section>
          <section className={CARD}><h3 className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted">{tr("api.js")}</h3><pre className={PRE}>{JS}</pre></section>
        </div>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
