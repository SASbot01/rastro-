import Link from "next/link";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { translator, type Locale, type Messages } from "@/lib/i18n";
import { getSession } from "@/lib/session";

export async function SiteHeader({ locale, messages }: { locale: Locale; messages: Messages }) {
  const tr = translator(messages);
  const session = await getSession();
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-[640px] items-center justify-between px-5 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink"
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          {tr("nav.brand")}
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={session ? "/cuenta" : "/entrar"}
            className="text-[13px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {session ? tr("nav.account") : tr("nav.login")}
          </Link>
          <LocaleSwitcher current={locale} messages={messages} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ messages }: { messages: Messages }) {
  const tr = translator(messages);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto w-full max-w-[640px] px-5 py-8">
        <p className="text-[13px] text-muted">{tr("footer.tagline")}</p>
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          <Link href="/privacidad" className="text-muted underline underline-offset-4 hover:text-ink">
            {tr("footer.privacy")}
          </Link>
          <Link href="/aviso-legal" className="text-muted underline underline-offset-4 hover:text-ink">
            {tr("footer.legal")}
          </Link>
        </nav>
        <p className="mt-5 text-[12px] text-faint">
          {year} {tr("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
