"use client";

import { useRef, useState } from "react";
import type { Finding } from "@/lib/report/findings";
import { safeSource } from "@/lib/report/presentation";
import { translator, type Messages } from "@/lib/i18n";
import { EmptyState } from "./EmptyState";

export function ReportStories({ findings, messages, onFinish, initialIndex = 0 }: { findings: Finding[]; messages: Messages; onFinish: () => void; initialIndex?: number }) {
  const tr = translator(messages);
  const [index, setIndex] = useState(initialIndex * 3);
  const start = useRef<{ x: number; y: number } | null>(null);
  if (!findings.length) return <EmptyState title={tr("experience.storyEmpty")} body={tr("experience.emptyBody")} />;
  const total = findings.length * 3;
  const finding = findings[Math.floor(index / 3)];
  const phase = index % 3;
  const source = safeSource(finding.source_url);
  function move(delta: number) { setIndex((n) => Math.max(0, Math.min(total - 1, n + delta))); }
  return <section className="ex-story" aria-label={tr("experience.stories")} tabIndex={0}
    onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); move(e.key === "ArrowRight" ? 1 : -1); } }}
    onTouchStart={(e) => { start.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }; }}
    onTouchEnd={(e) => { const point = e.changedTouches[0]; if (start.current) { const dx = start.current.x - point.clientX; const dy = start.current.y - point.clientY; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); } start.current = null; }}>
    <div className="ex-progress-segments" aria-hidden="true">{findings.map((_, i) => <i data-active={i <= Math.floor(index / 3)} key={i} />)}</div>
    <div className="ex-story-meta"><span className="ex-badge">{tr(`report.categories.${finding.category}`)}</span><span>{tr("experience.step", { current: index + 1, total })}</span></div>
    <div className="ex-story-content" aria-live="polite" aria-atomic="true">
      <span className="ex-story-number" aria-hidden="true">{String(Math.floor(index / 3) + 1).padStart(2, "0")}</span>
      <p className="ex-eyebrow">{tr(`experience.${["seen", "why", "do"][phase]}`)}</p>
      <h2>{finding.title}</h2>
      <p>{phase === 0 ? finding.detail : tr(`experience.${phase === 1 ? "whyCategory" : "doCategory"}.${finding.category}`)}</p>
      {phase === 2 && source && <a className="ex-text-link" href={source} target="_blank" rel="noopener noreferrer nofollow">{tr("experience.source")} ↗</a>}
    </div>
    <div className="ex-story-controls"><button className="ex-button-secondary" onClick={() => move(-1)} disabled={index === 0}>← {tr("experience.previous")}</button><button className="ex-button" onClick={() => index === total - 1 ? onFinish() : move(1)}>{tr(index === total - 1 ? "experience.finish" : "experience.next")} →</button></div>
    <p className="ex-note">{tr("experience.storyHint")}</p>
  </section>;
}
