import type { CSSProperties } from "react";
import { levelFor } from "@/lib/report/score";

export function ScoreRing({ score, label, size = 200 }: { score: number; label: string; size?: number }) {
  const value = Math.max(0, Math.min(100, score));
  const level = levelFor(value);
  const color = level === "green" ? "var(--color-ok)" : level === "orange" ? "var(--color-warn)" : "var(--color-danger)";
  return (
    <div className="ex-score" style={{ "--score-color": color, width: size, maxWidth: "100%" } as CSSProperties} role="img" aria-label={`${label}: ${value}/100`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="ex-score-track" cx="100" cy="100" r="88" />
        <circle className="ex-score-value" cx="100" cy="100" r="88" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - value} />
      </svg>
      <div><strong>{value}</strong><span>/ 100</span></div>
    </div>
  );
}
