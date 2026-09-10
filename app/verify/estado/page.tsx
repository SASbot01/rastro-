import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

/** Estados de error de los enlaces magicos: ?e=invalid | expired | login */
export default async function VerifyStatePage({ searchParams }: PageProps<"/verify/estado">) {
  const { e } = await searchParams;
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);

  const copy =
    e === "expired"
      ? { title: tr("verify.expiredTitle"), body: tr("verify.expiredBody"), cta: tr("verify.retry"), href: "/#form" }
      : e === "login"
        ? { title: tr("login.invalidTitle"), body: tr("login.invalidBody"), cta: tr("nav.login"), href: "/entrar" }
        : { title: tr("verify.invalidTitle"), body: tr("verify.invalidBody"), cta: tr("verify.retry"), href: "/#form" };

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-16">
        <div className="rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(26,26,25,0.04)] sm:p-8">
          <span aria-hidden="true" className="mb-5 block h-1.5 w-10 rounded-full bg-line" />
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{copy.title}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{copy.body}</p>
          <Link
            href={copy.href}
            className="mt-6 inline-block rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            {copy.cta}
          </Link>
        </div>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
