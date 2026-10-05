import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

/* ---------------------------------------------------------------------
   Piezas compartidas de las landings de herramientas. Todo reutiliza el
   sistema visual de globals.css (card, icon-tile, eyebrow, h2/h3, chip,
   btn, reveal/rise). Son componentes de servidor y reciben texto ya
   traducido: nada de strings fijos aquí.
   --------------------------------------------------------------------- */

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

/** Iconos de línea (24×24). El color lo pone el contenedor (currentColor). */
export const ICONS: Record<string, string> = {
  scan: "M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16",
  shield: "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3zM9 12l2 2 4-4",
  sparkle: "M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9L12 3.5zM18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8.8-1.9z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  image: "M4 5.5h16v13H4zM4 15l4.5-4.5 4 4 2.5-2.5 5 5M15 9.5v.01",
  puzzle: "M9 4.5h6v3a2 2 0 1 0 4 0V7h.5v6H17a2 2 0 1 0 0 4h2.5v2.5h-15V14H7a2 2 0 1 0 0-4H4.5V4.5H9z",
  bell: "M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5zM9.5 19a2.5 2.5 0 0 0 5 0",
  letter: "M4 6h16v12H4zM4 7l8 6 8-6",
  clock: "M12 12V7.5M12 12l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  users: "M10.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM4 19.5a6.5 6.5 0 0 1 9-6M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.2 19.2 21 21",
  bolt: "M13 3 4 14h6l-1 7 9-11h-6l1-7z",
  lock: "M6 10V8a6 6 0 1 1 12 0v2M5 10h14v10H5zM12 14v3",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 12h17M12 3c2.5 2.3 3.8 5.5 3.8 9s-1.3 6.7-3.8 9c-2.5-2.3-3.8-5.5-3.8-9S9.5 5.3 12 3z",
  chart: "M5 20V10M12 20V4M19 20v-7M3 20h18",
  check: "M5 12l4.5 4.5L19 7",
  alert: "M12 4 3.5 19h17L12 4zM12 10v4.5M12 17v.01",
};

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-[22px] w-[22px]"} aria-hidden="true">
      <path d={ICONS[name] ?? ICONS.check} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className = "text-accent" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={"h-3.5 w-3.5 shrink-0 " + className} aria-hidden="true">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Fila de garantías breves bajo el hero. */
export function TrustRow({ items, className = "" }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={"flex flex-wrap gap-x-5 gap-y-2 " + className}>
      {items.map((item) => (
        <li key={item} className="inline-flex items-center gap-1.5 text-[13.5px] text-muted">
          <CheckIcon />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="px-1 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted">{children}</h2>;
}

type Pillar = { icon: string; t: string; b: string };

/** Qué hace / por qué importa / qué te llevas: tres tarjetas con icono. */
export function Pillars({ items, labels }: { items: readonly Pillar[]; labels?: readonly string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {items.map((p, i) => (
        <li key={p.t} className="reveal card card-glow flex h-full flex-col p-5 sm:p-6" style={stagger(i)}>
          <span className="icon-tile" aria-hidden="true"><ToolIcon name={p.icon} /></span>
          {labels?.[i] && <span className="eyebrow mt-4 block !text-[11px]">{labels[i]}</span>}
          <h3 className="h3 mt-1.5 text-ink">{p.t}</h3>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{p.b}</p>
        </li>
      ))}
    </ul>
  );
}

type Faq = { q: string; a: string };

/** Acordeón de preguntas, mismo patrón que la portada. */
export function ToolFaq({ title, items }: { title: string; items: readonly Faq[] }) {
  return (
    <section className="reveal pb-4">
      <h2 className="h2 text-ink">{title}</h2>
      <div className="mt-6 grid gap-2.5">
        {items.map((f) => (
          <details key={f.q} className="card acc group card-link px-5">
            <summary className="flex min-h-[60px] items-center justify-between gap-4 py-4 text-[16px] font-semibold leading-snug text-ink">
              {f.q}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition-transform duration-300 group-open:rotate-180 group-open:text-accent" aria-hidden="true">
                <svg viewBox="0 0 20 20" className="h-4 w-4"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </summary>
            <p className="acc-body pb-5 text-[15px] leading-[1.65] text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Banda de llamada a la acción con luz de acento. */
export function CtaBand({ eyebrow, title, body, cta, href, secondaryCta, secondaryHref }: {
  eyebrow?: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  secondaryCta?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="reveal">
      <div className="card card-glow card-accent p-6 sm:p-9">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="h2 mt-2 text-ink">{title}</h2>
        <p className="lead mt-3 max-w-[60ch]">{body}</p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <Link href={href} className="btn btn-primary btn-lg">{cta}<ArrowIcon /></Link>
          {secondaryCta && secondaryHref && <Link href={secondaryHref} className="btn btn-ghost">{secondaryCta}</Link>}
        </div>
      </div>
    </section>
  );
}

/** Marco de "Ejemplo": una tarjeta etiquetada para que nadie confunda la maqueta con datos reales. */
export function ExampleFrame({ label, note, children, className = "" }: { label: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <div className={"relative " + className}>
      <span className="badge tone-ok absolute -top-2.5 left-4 z-10 uppercase">{label}</span>
      {children}
      {note && <p className="note mt-2 px-1">{note}</p>}
    </div>
  );
}
