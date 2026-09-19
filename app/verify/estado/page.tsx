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
      <main className="page py-16">
        <div className="card p-6 sm:p-8">
          <span aria-hidden="true" className="mb-5 block h-1.5 w-10 rounded-full bg-line" />
          <h1 className="h2 text-ink">{copy.title}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{copy.body}</p>
          <Link
            href={copy.href}
            className="mt-6 btn btn-primary"
          >
            {copy.cta}
          </Link>
        </div>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
