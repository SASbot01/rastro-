import type { CSSProperties } from "react";
import Link from "next/link";
import { translator, type Messages } from "@/lib/i18n";
import type { RemovalStats } from "@/lib/removals";

/* Ocho motas que salen una sola vez del contador cuando hay algo retirado. Solo CSS; con "reducir movimiento" no se ven. */
const CONFETTI = [
  { dx: "-46px", dy: "-38px", rot: "-140deg", d: 0 },
  { dx: "-22px", dy: "-58px", rot: "90deg", d: 60 },
  { dx: "6px", dy: "-64px", rot: "200deg", d: 20 },
  { dx: "34px", dy: "-50px", rot: "-80deg", d: 90 },
  { dx: "54px", dy: "-24px", rot: "160deg", d: 40 },
  { dx: "-58px", dy: "-8px", rot: "70deg", d: 110 },
  { dx: "48px", dy: "8px", rot: "-200deg", d: 70 },
  { dx: "-30px", dy: "14px", rot: "120deg", d: 130 },
];

/**
 * Contador de retiradas: de los sitios donde apareces, a cuantos se lo has
 * pedido y en cuantos hemos comprobado que ya no sales. Es la medida de que
 * Rastro sirve para algo, asi que va arriba en el panel y en Herramientas.
 */
export function RemovalCounter({ stats, messages, href, compact = false }: { stats: RemovalStats; messages: Messages; href: string; compact?: boolean }) {
  const tr = translator(messages);
  if (stats.found === 0) return null;
  const notRequested = Math.max(0, stats.found - stats.requested);
  const parts = [
    { key: "removed", n: stats.removed, cls: "bg-accent shadow-[0_0_12px_rgb(77_252_95/0.55)]", dot: "bg-accent" },
    { key: "pending", n: stats.pending, cls: "bg-accent/35", dot: "bg-accent/50" },
    { key: "overdue", n: stats.overdue, cls: "bg-warn", dot: "bg-warn" },
    { key: "refused", n: stats.refused, cls: "bg-danger", dot: "bg-danger" },
    { key: "notRequested", n: notRequested, cls: "bg-line-strong", dot: "bg-faint" },
  ].filter((p) => p.n > 0);
  const next = notRequested > 0 ? tr("removals.ctaRequest", { n: notRequested }) : stats.overdue > 0 ? tr("removals.ctaOverdue", { n: stats.overdue }) : tr("removals.ctaSee");
  const won = stats.removed > 0;

  return (
    <section className={"card min-w-0 " + (won ? "card-glow card-accent " : "overflow-hidden ") + (compact ? "p-5" : "p-6")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="h3 text-ink">{tr("removals.title")}</h2>
          <p className="mt-1.5 max-w-[48ch] text-[14px] leading-relaxed text-muted">{tr("removals.body")}</p>
        </div>
        <p className="relative shrink-0 leading-none" aria-label={tr("removals.aria", { removed: stats.removed, found: stats.found })}>
          {won && (
            <span className="pointer-events-none absolute left-1/3 top-1/2" aria-hidden="true">
              {CONFETTI.map((c, i) => (
                <i key={i} className="confetti" style={{ "--dx": c.dx, "--dy": c.dy, "--rot": c.rot, animationDelay: `${500 + c.d}ms` } as CSSProperties} />
              ))}
            </span>
          )}
          <span className={"num text-[52px] " + (won ? "text-glow text-accent" : "text-ink")} aria-hidden="true">{stats.removed}</span>
          <span className="num text-[22px] !font-medium text-faint" aria-hidden="true"> / {stats.found}</span>
        </p>
      </div>

      {won && (
        <p className="rise mt-3 inline-flex items-center gap-2 rounded-full bg-accent/12 py-1.5 pl-1.5 pr-3.5 text-[13.5px] font-medium text-accent shadow-[inset_0_0_0_1px_rgb(77_252_95/0.25)]">
          <span className="pop flex h-6 w-6 items-center justify-center rounded-full bg-accent text-black [animation-delay:350ms]" aria-hidden="true">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5"><path d="m5 10.5 3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          {tr("removals.celebrate", { n: stats.removed })}
        </p>
      )}

      <div className="mt-4 flex h-3.5 w-full gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
        {parts.map((p, i) => (
          <span key={p.key} className={"bar-grow h-full rounded-full " + p.cls} style={{ flexGrow: p.n, flexBasis: 0, "--i": i } as CSSProperties} />
        ))}
      </div>
      <ul className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2 text-[13.5px] text-muted">
            <span className={"h-2.5 w-2.5 rounded-full " + p.dot} aria-hidden="true" />
            <span className="font-semibold tabular-nums text-ink">{p.n}</span> {tr(`removals.legend.${p.key}`)}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line pt-4">
        <p className="note min-w-0 flex-1 basis-[240px]">{tr("removals.how")}</p>
        <Link href={href} className="btn btn-primary w-full shrink-0 sm:w-auto">{next}</Link>
      </div>
    </section>
  );
}
