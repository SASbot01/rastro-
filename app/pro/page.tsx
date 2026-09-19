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
function Card({ name, price, per, save, href, cta }: { name: string; price: string; per: string; save?: string; href: string | null; cta: string }) {
  return (
    <div className="flex flex-col rounded-card border border-line bg-surface p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{name}</h2>
        {save && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">{save}</span>}
      </div>
      <p className="mt-4 text-[40px] leading-none font-semibold tracking-[-0.03em] text-ink">{price}</p>
      <p className="mt-1 text-[13px] text-faint">{per}</p>
      {href ? (
        <a href={href} className="mt-6 rounded-[10px] bg-accent px-5 py-3 text-center text-[15px] font-semibold text-black hover:opacity-90">{cta}</a>
      ) : (
        <span className="mt-6 rounded-[10px] bg-paper px-5 py-3 text-center text-[14px] text-faint">—</span>
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
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-12 sm:py-16">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("pro.badge")}</p>
        <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-[-0.025em] text-ink">{tr("pro.title")}</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">{tr("pro.subtitle")}</p>

        {pro ? (
          <div className="mt-8 rounded-card border border-accent/30 bg-surface p-6">
            <p className="text-[15px] font-semibold text-ink">{tr("pro.active")}</p>
            <Link href="/cuenta" className="mt-3 inline-block text-[14px] font-medium text-accent underline underline-offset-4">
              {tr("nav.account")}
            </Link>
          </div>
        ) : (
          <div className={"mt-8 grid gap-4 " + (hasFamily ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <Card cta={tr("pro.cta")} name={tr("pro.monthly")} price={price.monthly} per={tr("pro.monthlyPer")} href={links.monthly && "/api/go/checkout?plan=monthly"} />
            <Card cta={tr("pro.cta")} name={tr("pro.yearly")} price={price.yearly} per={tr("pro.yearlyPer")} save={tr("pro.yearlySave")} href={links.yearly && "/api/go/checkout?plan=yearly"} />
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

        <ul className="mt-8 grid gap-3">
          {features.map((f) => (
            <li key={f} className="flex gap-2.5 text-[15px] leading-relaxed text-ink">
              <svg viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0" aria-hidden="true">
                <path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="#4dfc5f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[12.5px] text-faint">{tr("pro.note")}</p>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
