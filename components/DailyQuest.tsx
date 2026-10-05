"use client";

import { useState } from "react";

/** Iconos del reto (claves que usa el banco de retos). */
const ICONS: Record<string, string> = {
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  card: "M3 6h18v12H3zM3 10h18",
  shield: "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z",
  eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  location: "M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  camera: "M3 8h4l2-2h6l2 2h4v12H3zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  app: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  phone: "M7 3h10v18H7zM11 18h2",
  search: "M11 11a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14.5 14.5 21 21",
  trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13",
  wifi: "M2 8.5a14 14 0 0 1 20 0M5 12a9 9 0 0 1 14 0M8.5 15.5a4 4 0 0 1 7 0M12 19h.01",
  bell: "M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 0 0 4 0",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path d={ICONS[name] ?? ICONS.shield} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Flame({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={"h-5 w-5 " + (on ? "text-accent" : "text-faint")} aria-hidden="true">
      <path d="M12 2.5c2.5 3 5.5 5 5.5 9.5A5.5 5.5 0 0 1 6.5 12c0-1.8.8-3 1.8-4 .3 1 .9 1.7 1.7 2 0-2.3.8-4.4 2-7.5z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export interface DailyQuestLabels {
  eyebrow: string;
  today: string;
  doneBtn: string;
  doneToday: string;
  comeback: string;
  start: string;
  days: string; // "{n} días"
  dayOne: string; // "1 día"
  best: string; // "récord {n}"
}

export function DailyQuest({ quest, initialStreak, initialBest, initialDone, labels }: {
  quest: { icon: string; title: string; body: string };
  initialStreak: number;
  initialBest: number;
  initialDone: boolean;
  labels: DailyQuestLabels;
}) {
  const [streak, setStreak] = useState(initialStreak);
  const [best, setBest] = useState(initialBest);
  const [done, setDone] = useState(initialDone);
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState(false);

  async function complete() {
    if (busy || done) return;
    setBusy(true);
    try {
      const res = await fetch("/api/daily-quest", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { streak: number; best: number };
      setStreak(data.streak);
      setBest(data.best);
      setDone(true);
      setPop(true);
      setTimeout(() => setPop(false), 900);
    } catch {
      // Si falla, dejamos el botón disponible para reintentar.
    } finally {
      setBusy(false);
    }
  }

  const streakLabel = streak <= 0 ? labels.start : streak === 1 ? labels.dayOne : labels.days.replace("{n}", String(streak));

  return (
    <section className="card card-glow glow-ok rise p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{labels.eyebrow}</p>
        <span className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold tabular-nums transition-transform " + (streak > 0 ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-faint") + (pop ? " scale-110" : "")}>
          <Flame on={streak > 0} />
          {streakLabel}
        </span>
      </div>

      <div className="mt-4 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgb(77_252_95/0.22)]">
          <Icon name={quest.icon} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">{labels.today}</p>
          <h2 className="mt-1 text-[17px] font-semibold leading-snug text-ink">{quest.title}</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{quest.body}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {done ? (
          <>
            <span className="inline-flex items-center gap-2 rounded-[12px] bg-accent/12 px-4 py-2.5 text-[14px] font-semibold text-accent">
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {labels.doneToday}
            </span>
            <span className="text-[13px] text-faint">{labels.comeback}</span>
          </>
        ) : (
          <button type="button" onClick={complete} disabled={busy} className="btn btn-primary btn-sm disabled:opacity-60">
            {labels.doneBtn}
          </button>
        )}
        {best > 0 && <span className="ml-auto text-[12.5px] text-faint">{labels.best.replace("{n}", String(best))}</span>}
      </div>
    </section>
  );
}
