import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { MascotDemo } from "@/components/MascotDemo";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

import { track } from "@/lib/events";
export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro Guardián — ${tr("ext.title")}`, description: tr("ext.subtitle"), alternates: { canonical: "/extension" } };
}

/** Logo generico de Chrome (tres arcos), sin marca registrada en el codigo. */
function ChromeMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8h9.2M8.5 14 3.9 6.1M15.5 14l-4.6 8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Extension del navegador: que hace, robot jugable y como instalarla (tienda si hay URL; si no, manual). */
export default async function ExtensionPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const features = messages.ext.features as string[];
  const install = messages.ext.install as string[];
  const storeSteps = messages.ext.storeSteps as string[];
  void track("extension_page_viewed", { locale });
  const storeUrl = process.env.NEXT_PUBLIC_CHROME_STORE_URL || "";
  const edgeUrl = process.env.NEXT_PUBLIC_EDGE_STORE_URL || "";
  const CARD = "card p-5 sm:p-6";
  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-10 sm:py-14">
        <p className="eyebrow">{tr("ext.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("ext.title")}</h1>
        <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-muted">{tr("ext.subtitle")}</p>

        <section className="mt-6 rounded-card border border-accent/40 bg-accent-soft p-5">
          <h2 className="text-[16px] font-semibold text-ink">{tr("ext.play")}</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("ext.playBody")}</p>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className={CARD}>
            <ul className="grid gap-2.5">
              {features.map((f) => (
                <li key={f} className="flex gap-3 text-[14.5px] leading-relaxed text-ink"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{f}</li>
              ))}
            </ul>
          </section>
          <section className={CARD}>
            <h2 className="text-[16px] font-semibold text-ink">{tr("ext.installTitle")}</h2>
            {storeUrl ? (
              <>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("ext.storeBody")}</p>
                <a href={storeUrl} target="_blank" rel="noopener" className="mt-4 btn btn-primary">
                  <ChromeMark />{tr("ext.storeButton")}
                </a>
                {edgeUrl && <a href={edgeUrl} target="_blank" rel="noopener" className="ml-3 text-[13.5px] font-medium text-accent underline-offset-2 hover:underline">{tr("ext.storeEdge")}</a>}
                <ol className="mt-4 grid gap-2">
                  {storeSteps.map((s, i) => (
                    <li key={s} className="flex gap-3 text-[14px] leading-relaxed text-muted"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-black">{i + 1}</span>{s}</li>
                  ))}
                </ol>
              </>
            ) : (
              <>
                <p className="mt-1 text-[14px] font-medium text-ink">{tr("ext.soonTitle")}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("ext.soonBody")}</p>
                <ol className="mt-3 grid gap-2">
                  {install.map((s, i) => (
                    <li key={s} className="flex gap-3 text-[14px] leading-relaxed text-muted"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-black">{i + 1}</span>{s}</li>
                  ))}
                </ol>
                <a href="/extension/rastro-guardian.zip" className="mt-4 btn btn-primary">{tr("ext.download")}</a>
              </>
            )}
            <p className="mt-3 text-[12.5px] leading-relaxed text-faint">{tr("ext.privacy")} <Link href="/extension/privacidad" className="text-accent underline-offset-2 hover:underline">{tr("ext.privacyLink")}</Link></p>
          </section>
        </div>
      </main>
      <MascotDemo locale={locale} labels={messages.ext as unknown as Record<string, unknown>} />
      <SiteFooter messages={messages} />
    </>
  );
}
