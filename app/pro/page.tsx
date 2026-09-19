import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { FAMILY_SEATS, isPro, paymentLinks, prices } from "@/lib/plan";

export const dynamic = "force-dynamic";

/**
 * Pagina de precios. Los botones van a los Payment Links de Stripe con el
 * correo y la cuenta ya rellenados; el webhook activa Pro al completarse.
 * Sin cuenta tambien se puede pagar: el webhook la crea con el correo del pago.
 */
function Card({ name, price, per, save, href, cta, featured = false }: { name: string; price: string; per: string; save?: string; href: string | null; cta: string; featured?: boolean }) {
  return (
    <div className={"card rise flex flex-col p-6 " + (featured ? "card-glow card-accent shadow-[0_24px_60px_-34px_rgb(77_252_95/0.55)]" : "")}>
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

export default async function ProPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const pro = isPro(user);
  const links = paymentLinks(user?.email ?? session?.email, user?.id);
  const features = messages.pro.features as string[];
  const price = prices();
  const hasFamily = Boolean(links.familyMonthly || links.familyYearly);


  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-12 sm:py-16">
        <p className="eyebrow">{tr("pro.badge")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("pro.title")}</h1>
        <p className="lead mt-3 max-w-[60ch]">{tr("pro.subtitle")}</p>

        {pro ? (
          <div className="card card-glow card-accent mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
            <p className="flex items-center gap-3 text-[16px] font-semibold text-ink"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-black" aria-hidden="true"><svg viewBox="0 0 20 20" className="h-4 w-4"><path d="m5 10.5 3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>{tr("pro.active")}</p>
            <Link href="/cuenta" className="btn btn-secondary btn-sm">
              {tr("nav.account")}
            </Link>
          </div>
        ) : (
          <div className={"mt-8 grid gap-4 " + (hasFamily ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <Card cta={tr("pro.cta")} name={tr("pro.monthly")} price={price.monthly} per={tr("pro.monthlyPer")} href={links.monthly && "/api/go/checkout?plan=monthly"} />
            <Card cta={tr("pro.cta")} name={tr("pro.yearly")} price={price.yearly} per={tr("pro.yearlyPer")} save={tr("pro.yearlySave")} featured href={links.yearly && "/api/go/checkout?plan=yearly"} />
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
        <p className="note mt-5 px-1">{tr("pro.note")}</p>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
