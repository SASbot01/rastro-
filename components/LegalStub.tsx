import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator, type Messages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

/**
 * Paginas legales (Dia 6). El texto vive en messages/*.json; los datos del
 * responsable salen de variables de entorno para no hardcodearlos:
 *   NEXT_PUBLIC_LEGAL_OWNER, NEXT_PUBLIC_LEGAL_EMAIL, NEXT_PUBLIC_SITE_DOMAIN
 * Si faltan, se muestra "[pendiente]" bien visible: nunca un hueco en blanco.
 */

/** Fecha de la ultima revision del texto legal. Actualizar al cambiarlo. */
const LEGAL_UPDATED = "2026-09-10";

type Kind = "privacy" | "notice";
interface Section {
  title: string;
  paragraphs: string[];
}

function legalVars(messages: Messages) {
  const pending = messages.legal.pending;
  return {
    owner: process.env.NEXT_PUBLIC_LEGAL_OWNER || pending,
    email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || pending,
    domain: process.env.NEXT_PUBLIC_SITE_DOMAIN || pending,
  };
}

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

export async function LegalPage({ kind }: { kind: Kind }) {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const doc = messages.legal[kind] as { title: string; intro: string; sections: Section[] };
  const vars = legalVars(messages);
  const incomplete = Object.values(vars).includes(messages.legal.pending);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(LEGAL_UPDATED));

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-12 sm:py-14">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.025em] text-ink">{doc.title}</h1>
        <p className="mt-2 text-[13px] text-faint">{tr("legal.updated", { date })}</p>
        <p className="mt-5 text-[16px] leading-[1.65] text-muted">{doc.intro}</p>

        {incomplete && (
          <p className="mt-5 rounded-[10px] bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-accent">
            {tr("legal.reviewNote")}
          </p>
        )}

        <div className="mt-8 grid gap-8">
          {doc.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{s.title}</h2>
              <div className="mt-2.5 grid gap-2.5">
                {s.paragraphs.map((p, i) => (
                  <p key={i} className="text-[15px] leading-[1.7] text-muted">
                    {fill(p, vars)}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <Link href="/" className="mt-10 inline-block text-[14px] font-medium text-accent underline underline-offset-4">
          {tr("legal.back")}
        </Link>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
