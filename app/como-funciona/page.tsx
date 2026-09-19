import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro — ${tr("how.pageTitle")}`, description: tr("how.pageSubtitle"), alternates: { canonical: "/como-funciona" } };
}

/** Pagina de confianza: fuentes, retencion, lo que no hacemos, la regla de la puntuacion y seguridad. */
export default async function HowPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const sections = messages.how.sections as Array<{ t: string; items: string[] }>;
  const owner = process.env.NEXT_PUBLIC_LEGAL_OWNER || messages.legal.pending;
  const email = process.env.NEXT_PUBLIC_LEGAL_EMAIL || "hola@rastropro.com";

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-10 sm:py-14">
        <p className="eyebrow">Rastro</p>
        <h1 className="mt-2 h1 text-ink">{tr("how.pageTitle")}</h1>
        <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-muted">{tr("how.pageSubtitle")}</p>

        <div className="mt-8 grid gap-4">
          {sections.map((sec) => (
            <section key={sec.t} className="card p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{sec.t}</h2>
              <ul className="mt-3 grid gap-2.5">
                {sec.items.map((it) => (
                  <li key={it} className="flex gap-3 text-[14.5px] leading-relaxed text-muted">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {it}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="card p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{tr("how.ownerTitle")}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{tr("how.ownerBody", { owner, email })}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-[14px]">
              <Link href="/privacidad" className="font-medium text-accent underline underline-offset-4">{tr("footer.privacy")}</Link>
              <Link href="/aviso-legal" className="font-medium text-accent underline underline-offset-4">{tr("footer.legal")}</Link>
              <Link href="/soporte" className="font-medium text-accent underline underline-offset-4">{tr("support.button")}</Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
