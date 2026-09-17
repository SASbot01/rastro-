import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { MascotDemo } from "@/components/MascotDemo";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro Guardián — ${tr("ext.title")}`, description: tr("ext.subtitle"), alternates: { canonical: "/extension" } };
}

/** Extension del navegador: que hace, robot jugable y como instalarla. */
export default async function ExtensionPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const features = messages.ext.features as string[];
  const install = messages.ext.install as string[];
  const CARD = "rounded-card border border-line bg-surface p-5 sm:p-6";
  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-10 sm:py-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("ext.eyebrow")}</p>
        <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-ink sm:text-[40px]">{tr("ext.title")}</h1>
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
            <ol className="mt-3 grid gap-2">
              {install.map((s, i) => (
                <li key={s} className="flex gap-3 text-[14px] leading-relaxed text-muted"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-black">{i + 1}</span>{s}</li>
              ))}
            </ol>
            <a href="/extension/rastro-guardian.zip" className="mt-4 inline-block rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90">{tr("ext.download")}</a>
            <p className="mt-3 text-[12.5px] leading-relaxed text-faint">{tr("ext.privacy")}</p>
          </section>
        </div>
      </main>
      <MascotDemo locale={locale} labels={messages.ext as unknown as Record<string, unknown>} />
      <SiteFooter messages={messages} />
    </>
  );
}
