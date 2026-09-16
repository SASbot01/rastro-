"use client";

import { useEffect, useState } from "react";

interface Item { title: string; detail: string }

/** Pasos del ultimo informe con casillas; el estado vive en este dispositivo. */
export function GuideChecklist({ reportId, items, doneTemplate }: { reportId: string; items: Item[]; doneTemplate: string }) {
  const key = `rastro_guide_${reportId}`;
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));

  // Hidratacion desde localStorage: en servidor no existe, asi que se lee al montar.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "[]") as boolean[];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setDone(items.map((_, i) => Boolean(saved[i])));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function toggle(i: number) {
    const next = done.map((d, j) => (j === i ? !d : d));
    setDone(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  }

  const count = done.filter(Boolean).length;
  const pct = items.length ? Math.round((count / items.length) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[12.5px]">
        <span className="text-muted">{doneTemplate.replace("{done}", String(count)).replace("{total}", String(items.length))}</span>
        <span className="font-semibold text-ink">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-4 grid gap-2">
        {items.map((it, i) => (
          <li key={i}>
            <label className={"flex cursor-pointer items-start gap-3 rounded-[14px] border px-3.5 py-3 transition-colors " + (done[i] ? "border-accent/40 bg-accent-soft" : "border-line bg-surface-2 hover:border-faint")}>
              <input type="checkbox" checked={done[i]} onChange={() => toggle(i)} className="peer sr-only" />
              <span aria-hidden="true" className={"peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold " + (done[i] ? "border-accent bg-accent text-black" : "border-faint text-faint")}>
                {done[i] ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span className={"block text-[14px] font-semibold " + (done[i] ? "text-muted line-through" : "text-ink")}>{it.title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{it.detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ol>
    </div>
  );
}
