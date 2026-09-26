import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SupportForm } from "@/components/SupportForm";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Soporte: formulario que llega por correo al equipo, con acuse al usuario. */
export default async function SupportPage({ searchParams }: PageProps<"/soporte">) {
  const { p } = await searchParams;
  const locale = await getLocale();
  const messages = getMessages(locale);
  const session = await getSession();
  const page = typeof p === "string" && /^\/[\w\-/?=&.]*$/.test(p) ? p : null;

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-10 sm:py-14">
        <SupportForm messages={messages} locale={locale} email={session?.email ?? null} page={page} />
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
