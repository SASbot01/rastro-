import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { teamLinks, teamPrices } from "@/lib/plan";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro Equipos — ${tr("team.title")}`, description: tr("team.subtitle"), alternates: { canonical: "/equipos" } };
}

/** v5 — Landing publica de Rastro Equipos (B2B). */
function Card({ name, p, per, cta, contact, href }: { name: string; p: string; per: string; cta: string; contact: string; href: string | null }) {
  return (
    <div className="flex flex-col rounded-card border border-line bg-surface p-6">
      <h2 className="text-[15px] font-semibold text-ink">{name}</h2>
      <p className="mt-4 text-[40px] leading-none font-semibold tracking-[-0.03em] text-ink">{p}</p>
      <p className="mt-1 text-[13px] text-faint">{per}</p>
      {href ? (
        <a href={href} className="mt-6 rounded-[10px] bg-accent px-5 py-3 text-center text-[15px] font-semibold text-black hover:opacity-90">{cta}</a>
      ) : (
        <Link href="/soporte?p=/equipos" className="mt-6 rounded-[10px] border border-line bg-surface-2 px-5 py-3 text-center text-[15px] font-semibold text-ink hover:border-faint">{contact}</Link>
      )}
    </div>
  );
}

export default async function TeamsLanding() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const links = teamLinks(user?.email ?? session?.email, user?.id);
  const price = teamPrices();
  const features = messages.team.features as string[];
  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-12 sm:py-16">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("team.eyebrow")}</p>
        <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-[-0.025em] text-ink sm:text-[40px]">{tr("team.title")}</h1>
        <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-muted">{tr("team.subtitle")}</p>
        {user?.plan_kind === "team" ? (
          <Link href="/equipo" className="mt-6 inline-block rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90">{tr("team.dashTitle")} →</Link>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card name={tr("team.smallName")} p={price.small} per={tr("team.per", { n: price.smallSeats })} cta={tr("team.cta")} contact={tr("team.contact")} href={links.small} />
            <Card name={tr("team.largeName")} p={price.large} per={tr("team.per", { n: price.largeSeats })} cta={tr("team.cta")} contact={tr("team.contact")} href={links.large} />
          </div>
        )}
        <ul className="mt-8 grid gap-3">
          {features.map((f) => (
            <li key={f} className="flex gap-2.5 text-[15px] leading-relaxed text-ink"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{f}</li>
          ))}
        </ul>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
