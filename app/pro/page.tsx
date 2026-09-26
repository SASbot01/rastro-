import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator, type Messages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { FAMILY_SEATS, isPro, launchOffer, paymentLinks, prices } from "@/lib/plan";
import { removalStats } from "@/lib/removals";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Pagina de precios, construida alrededor de la promesa que se puede medir:
 * "pedimos la retirada por ti y comprobamos que el dato desaparece". Con
 * sesion e informe, la promesa se personaliza ("apareces en N sitios").
 * Los botones van a /api/go/checkout (cuenta el clic) y de ahi a Stripe.
 * Precio de lanzamiento: solo si hay enlace de Stripe para el; cupo por eventos pro_activated.
 */
function Card({ name, price, per, save, href, cta, featured = false, badge }: { name: string; price: string; per: string; save?: string; href: string | null; cta: string; featured?: boolean; badge?: string }) {
  return (
    <div className={"card rise relative flex flex-col p-6 " + (featured ? "card-glow card-accent shadow-[0_24px_60px_-34px_rgb(77_252_95/0.55)]" : "")}>
      {badge && <span className="absolute -top-3 left-5 rounded-full bg-accent px-3 py-1 text-[11.5px] font-semibold text-black">{badge}</span>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h3 text-ink">{name}</h2>
        {save && <span className="badge tone-ok">{save}</span>}
      </div>
      <p className="num mt-5 text-[44px] text-ink">{price}</p>
      <p className="mt-2 text-[14px] text-faint">{per}</p>
      {href ? (
        <a href={href} className={"btn mt-6 " + (featured ? "btn-primary" : "btn-secondary")}>{cta}</a>
      ) : (
        <span className="mt-6 rounded-[14px] bg-paper px-5 py-3 text-center text-[14px] text-faint">—</span>
      )}
    </div>
  );
}

async function launchSeatsLeft(total: number): Promise<number> {
  const { count } = await supabaseAdmin().from("product_events").select("id", { count: "exact", head: true }).eq("name", "pro_activated");
  return Math.max(0, total - (count ?? 0));
}

export default async function ProPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const pro = isPro(user);
  const links = paymentLinks(user?.email ?? session?.email, user?.id);
  const price = prices();
  const hasFamily = Boolean(links.familyMonthly || links.familyYearly);
  const launch = launchOffer();
  const [seatsLeft, stats] = await Promise.all([launch ? launchSeatsLeft(launch.seats) : Promise.resolve(0), user && !pro ? removalStats(user.id).catch(() => null) : Promise.resolve(null)]);
  const showLaunch = Boolean(launch && links.launchYearly && seatsLeft > 0);
  const features = messages.pro.features as string[];
  const how = messages.pro.how as Array<{ t: string; d: string }>;
  const compare = messages.pro.compare as Array<{ f: string; free: string; pro: string }>;
  const faq = messages.pro.faq as Array<{ q: string; a: string }>;
  const m: Messages = messages;

  return (
    <>
      <SiteHeader locale={locale} messages={m} />
      <main className="page py-12 sm:py-16">
        <p className="eyebrow">{tr("pro.badge")}</p>
        <h1 className="mt-2 h1 max-w-[22ch] text-ink">{tr("pro.title")}</h1>
        <p className="lead mt-3 max-w-[62ch]">{tr("pro.subtitle")}</p>
        {stats && (
          <p className={"mt-4 inline-flex max-w-[62ch] items-start gap-2 rounded-[14px] px-4 py-3 text-[14.5px] font-medium leading-relaxed " + (stats.found > 0 ? "bg-warn/10 text-warn" : "bg-accent-soft text-accent")}>
            <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-current" />
            {stats.found === 1 ? tr("pro.personalFoundOne") : stats.found > 1 ? tr("pro.personalFound", { n: stats.found }) : tr("pro.personalClean")}
          </p>
        )}

        {pro ? (
          <div className="card card-glow card-accent mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
            <p className="flex items-center gap-3 text-[16px] font-semibold text-ink"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-black" aria-hidden="true"><svg viewBox="0 0 20 20" className="h-4 w-4"><path d="m5 10.5 3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>{tr("pro.active")}</p>
            <Link href="/cuenta" className="btn btn-secondary btn-sm">{tr("nav.account")}</Link>
          </div>
        ) : (
          <div className={"mt-10 grid gap-4 " + (hasFamily ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <Card cta={tr("pro.cta")} name={tr("pro.monthly")} price={price.monthly} per={tr("pro.monthlyPer")} href={links.monthly && "/api/go/checkout?plan=monthly"} />
            {showLaunch && launch ? (
              <Card cta={tr("pro.cta")} name={tr("pro.launchName")} price={launch.price} per={tr("pro.launchPer", { yearly: price.yearly })} save={tr("pro.launchSave", { yearly: price.yearly })} featured badge={tr("pro.launchBadge", { n: seatsLeft, total: launch.seats })} href="/api/go/checkout?plan=launchYearly" />
            ) : (
              <Card cta={tr("pro.cta")} name={tr("pro.yearly")} price={price.yearly} per={tr("pro.yearlyPer")} save={tr("pro.yearlySave")} featured href={links.yearly && "/api/go/checkout?plan=yearly"} />
            )}
            {hasFamily && (
              <Card
                cta={tr("pro.cta")}
                name={tr("pro.family")}
                price={links.familyYearly && !links.familyMonthly ? price.familyYearly : price.familyMonthly}
                per={links.familyYearly && !links.familyMonthly ? tr("pro.familyYearlyPer", { n: FAMILY_SEATS }) : tr("pro.familyPer", { n: FAMILY_SEATS })}
                save={tr("pro.familyHint")}
                href={links.familyMonthly ? "/api/go/checkout?plan=familyMonthly" : "/api/go/checkout?plan=familyYearly"}
              />
            )}
          </div>
        )}
        <p className="note mt-4 px-1">{tr("pro.note")}</p>

        {/* Como funciona: encontramos, pedimos, comprobamos */}
        <section className="mt-12">
          <h2 className="h2 text-ink">{tr("pro.howTitle")}</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {how.map((s, i) => (
              <li key={s.t} className="card flex flex-col p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[14px] font-semibold text-black">{i + 1}</span>
                <h3 className="mt-4 text-[17px] font-semibold text-ink">{s.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Lo que mides */}
        <section className="card card-accent mt-8 flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <p className="num shrink-0 text-[52px] leading-none text-accent">2<span className="text-[26px] text-faint"> / 8</span></p>
          <div>
            <h2 className="text-[18px] font-semibold text-ink">{tr("pro.measureTitle")}</h2>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{tr("pro.measureBody")}</p>
          </div>
        </section>

        {/* Comparativa */}
        <section className="mt-12">
          <h2 className="h2 text-ink">{tr("pro.compareTitle")}</h2>
          <div className="card mt-5 overflow-hidden p-0">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12.5px] uppercase tracking-[0.06em] text-faint">
                  <th className="px-4 py-3 font-semibold sm:px-5"> </th>
                  <th className="px-3 py-3 font-semibold">{tr("pro.colFree")}</th>
                  <th className="px-3 py-3 font-semibold text-accent sm:px-5">{tr("pro.colPro")}</th>
                </tr>
              </thead>
              <tbody>
                {compare.map((r) => (
                  <tr key={r.f} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-ink sm:px-5">{r.f}</td>
                    <td className="px-3 py-3 text-muted">{r.free}</td>
                    <td className="px-3 py-3 font-medium text-ink sm:px-5">{r.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ul className="card mt-8 grid gap-3.5 p-6 sm:grid-cols-2 sm:gap-x-8">
          {features.map((f) => (
            <li key={f} className="flex gap-3 text-[15px] leading-relaxed text-ink">
              <svg viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0" aria-hidden="true">
                <path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="#4dfc5f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {f}
            </li>
          ))}
        </ul>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="h2 text-ink">{tr("pro.faqTitle")}</h2>
          <div className="mt-5 grid gap-3">
            {faq.map((q) => (
              <details key={q.q} className="card group p-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {q.q}
                  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" aria-hidden="true"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </summary>
                <p className="border-t border-line px-5 py-4 text-[14.5px] leading-relaxed text-muted">{q.a}</p>
              </details>
            ))}
          </div>
        </section>

        {!pro && (
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-card border border-accent/40 bg-accent-soft p-6">
            <p className="text-[16px] font-semibold text-ink">{tr("pro.title")}</p>
            <a href={showLaunch ? "/api/go/checkout?plan=launchYearly" : links.yearly ? "/api/go/checkout?plan=yearly" : "/api/go/checkout?plan=monthly"} className="btn btn-primary">{tr("pro.cta")}</a>
          </div>
        )}
      </main>
      <SiteFooter messages={m} />
    </>
  );
}
