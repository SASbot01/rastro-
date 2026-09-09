import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

/**
 * Marcador de posicion para los textos legales. Se sustituye por el
 * contenido real en el Dia 6, antes de que el servicio se abra a nadie.
 */
export async function LegalStub({ titleKey }: { titleKey: "privacyTitle" | "legalTitle" }) {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] px-5 py-14">
        <span className="inline-block rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
          {tr("legalStub.draft")}
        </span>
        <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-ink">
          {tr(`legalStub.${titleKey}`)}
        </h1>
        <p className="mt-4 text-[15px] leading-[1.7] text-muted">{tr("legalStub.body")}</p>
        <Link
          href="/"
          className="mt-8 inline-block text-[14px] font-medium text-accent underline underline-offset-4"
        >
          {tr("legalStub.back")}
        </Link>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
