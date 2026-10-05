import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/cuenta");
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-12 sm:py-16">
        <LoginForm messages={messages} locale={locale} googleEnabled={googleConfigured()} />
        <p className="mx-auto mt-6 max-w-[400px] border-t border-line pt-5 text-center text-[13.5px] text-muted">
          {tr("team.eyebrow")} · <Link href="/empresas/acceso" className="link">{tr("teamAccess.title")} →</Link>
        </p>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
