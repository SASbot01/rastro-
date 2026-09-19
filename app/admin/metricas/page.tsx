import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteChrome";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { EVENTS, FUNNEL, type EventName } from "@/lib/events";

export const metadata: Metadata = { title: "Métricas", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Metricas internas del producto (embudo). Solo para los correos de ADMIN_EMAILS
 * (separados por comas); para cualquier otra persona, 404. Pagina interna en
 * castellano: no pasa por messages/*.json porque no la ve ningun usuario.
 */
const LABEL: Record<EventName, string> = {
  form_submitted: "Formulario enviado", email_verified: "Correo verificado", report_ready: "Informe generado", report_failed: "Informe fallido",
  report_viewed: "Informe visto", report_shared: "Informe compartido", signup: "Cuenta nueva", login: "Inicio de sesión",
  letter_created: "Carta creada", letter_sent: "Carta enviada", removal_verified: "Retirada comprobada",
  checkout_started: "Fue a pagar", pro_activated: "Pro activado", monitoring_on: "Vigilancia activada",
  guardian_used: "Guardián usado", simulator_used: "Simulador usado", images_used: "Imágenes usado", mailbox_scanned: "Buzón escaneado",
  ai_change_detected: "Cambio en la IA detectado", site_check_listed: "Informe con sitios de datos", extension_page_viewed: "Página de extensión vista", extension_download: "Extensión descargada",
};

interface Count { name: string; total: number; uniques: number }
interface Daily { day: string; name: string; total: number }

function admins(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const session = await getSession();
  if (!session || !admins().includes(session.email.toLowerCase())) notFound();
  const locale = await getLocale();
  const messages = getMessages(locale);
  const { d } = await searchParams;
  const days = [7, 30, 90].includes(Number(d)) ? Number(d) : 30;
  // eslint-disable-next-line react-hooks/purity -- componente de servidor: la fecha de referencia se toma una vez por peticion
  const now = Date.now();
  const since = new Date(now - days * 86_400_000).toISOString();
  const supabase = supabaseAdmin();
  const [{ data: counts }, { data: daily }, { data: speed }, users, pros] = await Promise.all([
    supabase.rpc("product_event_counts", { since }),
    supabase.rpc("product_event_daily", { since }),
    supabase.from("product_events").select("props").eq("name", "report_ready").gte("at", since).order("at", { ascending: false }).limit(200).returns<Array<{ props: { seconds?: number } }>>(),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("plan", "pro"),
  ]);
  const by = new Map(((counts ?? []) as Count[]).map((c) => [c.name, c]));
  const n = (name: EventName) => Number(by.get(name)?.uniques ?? 0);
  const top = Math.max(1, n(FUNNEL[0]));
  const secs = (speed ?? []).map((s) => Number(s.props?.seconds)).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const median = secs.length ? secs[Math.floor(secs.length / 2)] : null;

  // Serie diaria de los cuatro eventos clave.
  const series: EventName[] = ["form_submitted", "report_ready", "signup", "pro_activated"];
  const dayKeys = Array.from({ length: days }, (_, i) => new Date(now - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
  const perDay = new Map<string, number>();
  for (const r of (daily ?? []) as Daily[]) perDay.set(`${String(r.day).slice(0, 10)}|${r.name}`, Number(r.total));
  const maxDay = Math.max(1, ...dayKeys.map((k) => perDay.get(`${k}|form_submitted`) ?? 0));
  const others = EVENTS.filter((e) => !FUNNEL.includes(e));
  const CARD = "rounded-card border border-line bg-surface p-5 sm:p-6";

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[920px] px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">Interno</p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-ink">Métricas de producto</h1>
            <p className="mt-1 text-[13.5px] text-muted">Personas únicas por paso en los últimos {days} días. Sin IP, sin correos: solo contadores.</p>
          </div>
          <nav className="flex gap-1.5">
            {[7, 30, 90].map((x) => (
              <a key={x} href={`?d=${x}`} className={"rounded-full border px-3 py-1.5 text-[12.5px] font-semibold " + (x === days ? "border-accent bg-accent text-black" : "border-line text-muted hover:border-accent")}>{x} días</a>
            ))}
          </nav>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { v: users.count ?? 0, l: "Cuentas totales" },
            { v: pros.count ?? 0, l: "Cuentas Pro" },
            { v: n("form_submitted") ? `${Math.round((n("pro_activated") / n("form_submitted")) * 1000) / 10}%` : "—", l: "Formulario → Pro" },
            { v: median === null ? "—" : `${median} s`, l: "Informe (mediana)" },
          ].map((k) => (
            <div key={k.l} className={CARD + " !p-4"}><p className="text-[26px] font-semibold tracking-[-0.03em] text-ink">{k.v}</p><p className="mt-0.5 text-[12px] text-faint">{k.l}</p></div>
          ))}
        </div>

        <section className={CARD + " mt-4"}>
          <h2 className="text-[16px] font-semibold text-ink">Embudo</h2>
          <ol className="mt-4 grid gap-2.5">
            {FUNNEL.map((e, i) => {
              const v = n(e);
              const prev = i > 0 ? n(FUNNEL[i - 1]) : 0;
              const step = i > 0 && prev > 0 ? Math.round((v / prev) * 100) : null;
              return (
                <li key={e} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-[13px]">
                  <span className="truncate text-muted">{LABEL[e]}</span>
                  <span className="h-6 overflow-hidden rounded-[6px] bg-surface-2"><span className="block h-full rounded-[6px] bg-accent" style={{ width: `${Math.max(v > 0 ? 2 : 0, (v / top) * 100)}%` }} /></span>
                  <span className="w-24 text-right font-semibold text-ink">{v}{step !== null && <span className={"ml-2 text-[11.5px] font-medium " + (step < 30 ? "text-danger" : step < 60 ? "text-warn" : "text-accent")}>{step}%</span>}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[12px] text-faint">El porcentaje es la conversión desde el paso anterior. En rojo, el paso donde más gente se cae.</p>
        </section>

        <section className={CARD + " mt-4"}>
          <h2 className="text-[16px] font-semibold text-ink">Día a día</h2>
          <div className="mt-4 flex h-28 items-end gap-[2px]" role="img" aria-label="Formularios enviados por día">
            {dayKeys.map((k) => {
              const v = perDay.get(`${k}|form_submitted`) ?? 0;
              return <span key={k} title={`${k}: ${v} formularios, ${perDay.get(`${k}|report_ready`) ?? 0} informes`} className="min-w-0 flex-1 rounded-t-[3px] bg-accent/80" style={{ height: `${Math.max(v > 0 ? 4 : 1, (v / maxDay) * 100)}%`, opacity: v > 0 ? 1 : 0.18 }} />;
            })}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[12.5px]">
              <thead><tr className="text-faint"><th className="py-1 font-medium">Últimos 7 días</th>{dayKeys.slice(-7).map((k) => <th key={k} className="py-1 text-right font-medium">{k.slice(5)}</th>)}</tr></thead>
              <tbody>
                {series.map((e) => (
                  <tr key={e} className="border-t border-line"><td className="py-1.5 text-muted">{LABEL[e]}</td>{dayKeys.slice(-7).map((k) => <td key={k} className="py-1.5 text-right text-ink">{perDay.get(`${k}|${e}`) ?? 0}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={CARD + " mt-4"}>
          <h2 className="text-[16px] font-semibold text-ink">Uso de herramientas y resultados</h2>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {others.map((e) => (
              <li key={e} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-[13px]"><span className="text-muted">{LABEL[e]}</span><span className="font-semibold text-ink">{Number(by.get(e)?.total ?? 0)} <span className="text-[11.5px] font-normal text-faint">({Number(by.get(e)?.uniques ?? 0)} únicos)</span></span></li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
