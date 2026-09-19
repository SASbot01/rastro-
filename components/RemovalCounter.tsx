import Link from "next/link";
import { translator, type Messages } from "@/lib/i18n";
import type { RemovalStats } from "@/lib/removals";

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
    { key: "removed", n: stats.removed, cls: "bg-accent", dot: "bg-accent" },
    { key: "pending", n: stats.pending, cls: "bg-accent/35", dot: "bg-accent/50" },
    { key: "overdue", n: stats.overdue, cls: "bg-warn", dot: "bg-warn" },
    { key: "refused", n: stats.refused, cls: "bg-danger", dot: "bg-danger" },
    { key: "notRequested", n: notRequested, cls: "bg-line", dot: "bg-faint" },
  ].filter((p) => p.n > 0);
  const next = notRequested > 0 ? tr("removals.ctaRequest", { n: notRequested }) : stats.overdue > 0 ? tr("removals.ctaOverdue", { n: stats.overdue }) : tr("removals.ctaSee");

  return (
    <section className={"min-w-0 overflow-hidden rounded-card border border-line bg-surface " + (compact ? "p-5" : "p-6")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-ink">{tr("removals.title")}</h2>
          <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-muted">{tr("removals.body")}</p>
        </div>
        <p className="shrink-0 leading-none" aria-label={tr("removals.aria", { removed: stats.removed, found: stats.found })}>
          <span className="text-[44px] font-semibold tracking-[-0.04em] text-accent">{stats.removed}</span>
          <span className="text-[20px] font-medium text-faint"> / {stats.found}</span>
        </p>
      </div>
      <div className="mt-4 flex h-3 w-full gap-[3px] overflow-hidden rounded-full" role="img" aria-hidden="true">
        {parts.map((p) => (
          <span key={p.key} className={"h-full rounded-full " + p.cls} style={{ flexGrow: p.n, flexBasis: 0 }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <span className={"h-2 w-2 rounded-full " + p.dot} />
            <span className="font-semibold text-ink">{p.n}</span> {tr(`removals.legend.${p.key}`)}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] leading-relaxed text-faint">{tr("removals.how")}</p>
        <Link href={href} className="shrink-0 rounded-[12px] bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-black hover:opacity-90">{next}</Link>
      </div>
    </section>
  );
}
