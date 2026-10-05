import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

/** Politica de privacidad de la extension (requisito de la Chrome Web Store). Texto en messages.extPrivacy. */
const UPDATED = "2026-09-18";

export async function generateMetadata(): Promise<Metadata> {
  const m = getMessages(await getLocale());
  return { title: m.extPrivacy.title, description: m.extPrivacy.intro, alternates: { canonical: "/extension/privacidad" } };
}

export default async function ExtensionPrivacyPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const doc = messages.extPrivacy as { title: string; intro: string; sections: { title: string; paragraphs: string[] }[] };
  const vars: Record<string, string> = {
    owner: process.env.NEXT_PUBLIC_LEGAL_OWNER || messages.legal.pending,
    email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || messages.legal.pending,
  };
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(UPDATED));
  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-12 sm:py-14">
        <h1 className="h1 text-ink">{doc.title}</h1>
        <p className="mt-2 text-[13px] text-faint">{messages.legal.updated.replace("{date}", date)}</p>
        <p className="mt-5 text-[16px] leading-[1.65] text-muted">{doc.intro}</p>
        <div className="mt-8 grid gap-8">
          {doc.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-[18px] font-semibold text-ink">{s.title}</h2>
              {s.paragraphs.map((p) => (
                <p key={p} className="mt-2 text-[15px] leading-[1.7] text-muted">{fill(p)}</p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
