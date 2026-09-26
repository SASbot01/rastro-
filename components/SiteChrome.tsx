import Link from "next/link";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { TopTabs } from "@/components/BottomNav";
import { translator, type Locale, type Messages } from "@/lib/i18n";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

export async function SiteHeader({ locale, messages }: { locale: Locale; messages: Messages }) {
  const tr = translator(messages);
  const session = await getSession();
  const me = session ? await findUserByEmail(session.email) : null;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="page flex min-h-[60px] items-center justify-between gap-3">
        <Link
          href="/"
          className="flex min-h-[44px] items-center gap-2 text-[16px] font-semibold tracking-[-0.02em] text-ink lg:invisible"
        >
          <img src="/brand/logo-96.png" alt="" width={26} height={22} className="h-[22px] w-auto shrink-0" />
          <span className="max-[339px]:sr-only">{tr("nav.brand")}</span>
        </Link>
        <TopTabs messages={messages} />
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/ayuda-urgente" aria-label={tr("experience.emergency")} title={tr("experience.emergency")} className="hit flex h-10 w-10 items-center justify-center rounded-full border border-danger/40 text-[15px] font-bold text-danger transition-colors hover:bg-danger/10">!</Link>
          <Link
            href="/soporte"
            aria-label={tr("support.button")}
            title={tr("support.button")}
            className={"hit h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-muted transition-colors hover:border-line-strong hover:text-ink " + (session ? "flex" : "hidden min-[420px]:flex")}
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
            className={"hit flex h-10 items-center justify-center overflow-hidden rounded-full text-[13.5px] font-semibold transition-[filter,border-color] " + (session ? "w-10 border border-line bg-surface-2 text-ink hover:border-accent/60" : "whitespace-nowrap bg-accent px-4 text-[#04210a] shadow-[0_6px_18px_-8px_rgb(77_252_95/0.7)] hover:brightness-105")}
          >
            {me?.avatar ? <img src={me.avatar} alt="" className="h-10 w-10 object-cover" /> : session ? (me?.display_name ?? session.email).slice(0, 1).toUpperCase() : tr("nav.login")}
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
      <div className="page py-9">
        <p className="flex items-center gap-2 text-[14px] font-medium text-ink"><img src="/brand/logo-96.png" alt="" width={22} height={18} className="h-[18px] w-auto" />{tr("footer.tagline")}</p>
        <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px]">
          <Link href="/privacidad" className="link-muted inline-flex min-h-[36px] items-center">
            {tr("footer.privacy")}
          </Link>
          <Link href="/aviso-legal" className="link-muted inline-flex min-h-[36px] items-center">
            {tr("footer.legal")}
          </Link>
          <Link href="/soporte" className="link-muted inline-flex min-h-[36px] items-center">
            {tr("support.button")}
          </Link>
          <Link href="/como-funciona" className="link-muted inline-flex min-h-[36px] items-center">
            {tr("how.footerLink")}
          </Link>
          <Link href="/sitios" className="link-muted inline-flex min-h-[36px] items-center">
            {tr("sites.footerLink")}
          </Link>
          <Link href="/extension" className="link-muted inline-flex min-h-[36px] items-center">
            {tr("ext.eyebrow")}
          </Link>
          <Link href="/api-docs" className="link-muted inline-flex min-h-[36px] items-center">
            {tr("api.footerLink")}
          </Link>
          <Link href="/equipos" className="link-muted inline-flex min-h-[36px] items-center">
            {tr("team.eyebrow")}
          </Link>
          <Link href="/pro" className="link-muted inline-flex min-h-[36px] items-center">
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
