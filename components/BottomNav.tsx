"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { translator, type Messages } from "@/lib/i18n";

/**
 * Barra inferior (movil) / barra superior (escritorio) con las 4 secciones:
 * Inicio · Informe · Herramientas · Perfil. El estado activo sale de la ruta.
 */
const TABS = [
  { key: "home", href: "/", match: (p: string) => p === "/" },
  { key: "report", href: "/informe", match: (p: string) => p.startsWith("/informe") },
  { key: "tools", href: "/herramientas", match: (p: string) => ["/herramientas", "/cartas", "/cuenta/buzon", "/guardian", "/simulador", "/imagenes", "/ayuda-urgente"].some((route) => p.startsWith(route)) },
  { key: "profile", href: "/cuenta", match: (p: string) => p === "/cuenta" || p.startsWith("/entrar") || p.startsWith("/pro") },
] as const;

function Icon({ name, active }: { name: (typeof TABS)[number]["key"]; active: boolean }) {
  const stroke = "currentColor";
  const common = { fill: "none", stroke, strokeWidth: active ? 2 : 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden="true">
          <rect x="3.5" y="3.5" width="7" height="7" rx="2" {...common} />
          <rect x="13.5" y="3.5" width="7" height="7" rx="2" {...common} />
          <rect x="3.5" y="13.5" width="7" height="7" rx="2" {...common} />
          <rect x="13.5" y="13.5" width="7" height="7" rx="2" {...common} />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" {...common} />
          <path d="M12 7.5v4.5l3 2" {...common} />
        </svg>
      );
    case "tools":
      return (
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden="true">
          <path d="M4 7.5h16v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" {...common} />
          <path d="M4 8l8 5.5L20 8" {...common} />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden="true">
          <circle cx="12" cy="8.5" r="3.75" {...common} />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" {...common} />
        </svg>
      );
  }
}

export function BottomNav({ messages }: { messages: Messages }) {
  const tr = translator(messages);
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label={tr("nav.sections")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/85 backdrop-blur-xl sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-[520px] grid-cols-4 px-1.5">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={"group flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[14px] text-[11.5px] font-medium tracking-[-0.005em] transition-colors " + (active ? "text-accent" : "text-muted hover:text-ink")}
              >
                <span className={"flex h-8 w-14 items-center justify-center rounded-full transition-[background-color,transform] duration-300 group-active:scale-90 " + (active ? "bg-accent/14 shadow-[inset_0_0_0_1px_rgb(77_252_95/0.22)]" : "bg-transparent")}>
                  <Icon name={t.key} active={active} />
                </span>
                {tr(`nav.tabs.${t.key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Enlaces de seccion para escritorio (en la cabecera). */
export function TopTabs({ messages }: { messages: Messages }) {
  const tr = translator(messages);
  const pathname = usePathname() ?? "/";
  return (
    <ul className="hidden items-center gap-1 sm:flex lg:hidden">
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={"inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[13.5px] font-medium transition-colors " + (active ? "bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-muted hover:text-ink")}
            >
              {tr(`nav.tabs.${t.key}`)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Barra lateral para pantallas grandes (lg+). */
export function SideNav({ messages }: { messages: Messages }) {
  const tr = translator(messages);
  const pathname = usePathname() ?? "/";
  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
      <Link href="/" className="flex min-h-[44px] items-center gap-2.5 px-2 text-[17px] font-semibold tracking-[-0.02em] text-ink">
        <img src="/brand/logo-96.png" alt="" width={30} height={26} className="h-[26px] w-auto" />
        {tr("nav.brand")}
      </Link>
      <ul className="mt-8 grid gap-1">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={"relative flex min-h-[46px] items-center gap-3 rounded-[14px] px-3.5 text-[14.5px] font-medium transition-colors " + (active ? "bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--color-line)] [&>svg]:text-accent" : "text-muted hover:bg-surface hover:text-ink")}
              >
                <Icon name={t.key} active={active} />
                {tr(`nav.tabs.${t.key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto grid gap-3 px-2">
        <Link href="/ayuda-urgente" className="ex-emergency-link">{tr("experience.emergency")} ↗</Link>
        <p className="text-[12px] leading-relaxed text-faint">{tr("footer.tagline")}</p>
      </div>
    </aside>
  );
}
