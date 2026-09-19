import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { GuardianForm } from "@/components/GuardianForm";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro — ${tr("guardian.title")}`, description: tr("guardian.subtitle") };
}

/** v3 — Guardian: ¿es una estafa? Pega el mensaje y te lo decimos, con tus datos como contexto si tienes cuenta. */
export default async function GuardianPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-8 sm:py-12">
        <p className="eyebrow">{tr("guardian.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("guardian.title")}</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted">{tr("guardian.subtitle")}</p>
        <div className="mt-6"><GuardianForm messages={messages} locale={locale} personalized={Boolean(session)} /></div>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
