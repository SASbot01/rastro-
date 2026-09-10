import Link from "next/link";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { TopTabs } from "@/components/BottomNav";
import { translator, type Locale, type Messages } from "@/lib/i18n";
import { getSession } from "@/lib/session";

export async function SiteHeader({ locale, messages }: { locale: Locale; messages: Messages }) {
  const tr = translator(messages);
  const session = await getSession();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[640px] lg:max-w-[920px] items-center justify-between gap-4 px-5 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink lg:invisible"
        >
          <img src="/brand/logo-96.png" alt="" width={26} height={22} className="h-[22px] w-auto" />
          {tr("nav.brand")}
        </Link>
        <TopTabs messages={messages} />
        <div className="flex items-center gap-2">
          <Link
            href="/soporte"
            aria-label={tr("support.button")}
            title={tr("support.button")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path d="M6 6l3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </Link>
          <Link
            href={session ? "/cuenta" : "/entrar"}
            aria-label={session ? tr("nav.account") : tr("nav.login")}
            className={"flex h-9 items-center justify-center rounded-full px-3 text-[13px] font-semibold " + (session ? "bg-surface-2 text-ink" : "bg-accent text-black")}
          >
            {session ? session.email.slice(0, 1).toUpperCase() : tr("nav.login")}
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
      <div className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-8">
        <p className="text-[13px] text-muted">{tr("footer.tagline")}</p>
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          <Link href="/privacidad" className="text-muted underline underline-offset-4 hover:text-ink">
            {tr("footer.privacy")}
          </Link>
          <Link href="/aviso-legal" className="text-muted underline underline-offset-4 hover:text-ink">
            {tr("footer.legal")}
          </Link>
          <Link href="/pro" className="text-muted underline underline-offset-4 hover:text-ink">
            {tr("pro.title")}
          </Link>
        </nav>
        <p className="mt-5 text-[12px] text-faint">
          {year} {tr("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
