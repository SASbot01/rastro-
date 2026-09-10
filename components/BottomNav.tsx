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
  { key: "tools", href: "/herramientas", match: (p: string) => p.startsWith("/herramientas") || p.startsWith("/cartas") || p.startsWith("/cuenta/buzon") },
  { key: "profile", href: "/cuenta", match: (p: string) => p === "/cuenta" || p.startsWith("/entrar") || p.startsWith("/pro") },
] as const;

function Icon({ name, active }: { name: (typeof TABS)[number]["key"]; active: boolean }) {
  const stroke = active ? "#4dfc5f" : "currentColor";
  const common = { fill: "none", stroke, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <rect x="3.5" y="3.5" width="7" height="7" rx="2" {...common} />
          <rect x="13.5" y="3.5" width="7" height="7" rx="2" {...common} />
          <rect x="3.5" y="13.5" width="7" height="7" rx="2" {...common} />
          <rect x="13.5" y="13.5" width="7" height="7" rx="2" {...common} />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" {...common} />
          <path d="M12 7.5v4.5l3 2" {...common} />
        </svg>
      );
    case "tools":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path d="M4 7.5h16v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" {...common} />
          <path d="M4 8l8 5.5L20 8" {...common} />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-[640px] lg:max-w-[920px] grid-cols-4">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={"flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium " + (active ? "text-accent" : "text-faint hover:text-muted")}
              >
                <span className={"h-0.5 w-8 rounded-full " + (active ? "bg-accent" : "bg-transparent")} />
                <Icon name={t.key} active={active} />
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
              className={"rounded-full px-3 py-1.5 text-[13px] font-medium " + (active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink")}
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
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-line bg-paper px-4 py-6 lg:flex">
      <Link href="/" className="flex items-center gap-2 px-2 text-[16px] font-semibold tracking-[-0.01em] text-ink">
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
                className={"flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] font-medium " + (active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface hover:text-ink")}
              >
                <Icon name={t.key} active={active} />
                {tr(`nav.tabs.${t.key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto px-2 text-[12px] leading-relaxed text-faint">{tr("footer.tagline")}</p>
    </aside>
  );
}
