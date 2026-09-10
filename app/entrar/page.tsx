import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/cuenta");
  const locale = await getLocale();
  const messages = getMessages(locale);
  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-12 sm:py-16">
        <LoginForm messages={messages} locale={locale} googleEnabled={googleConfigured()} />
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
