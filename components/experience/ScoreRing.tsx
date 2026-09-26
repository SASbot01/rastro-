import type { CSSProperties } from "react";
import { levelFor, type Level } from "@/lib/report/score";

/** Color del semaforo como variable CSS y como terna RGB (para luces con transparencia). */
export const LEVEL_VAR: Record<Level, string> = { green: "var(--color-ok)", orange: "var(--color-warn)", red: "var(--color-danger)" };
export const LEVEL_RGB: Record<Level, string> = { green: "var(--accent-rgb)", orange: "var(--warn-rgb)", red: "var(--danger-rgb)" };

/**
 * Anillo de puntuacion: marcas de instrumento, trazo con luz del color del
 * semaforo y numero que sube hasta la nota (solo CSS; con "reducir movimiento"
 * aparece directamente el valor final). El lector de pantalla lee el aria-label.
 */
export function ScoreRing({ score, label, size = 200, animate = true }: { score: number; label: string; size?: number; animate?: boolean }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const level = levelFor(value);
  return (
    <div className="ex-score" style={{ "--score-color": LEVEL_VAR[level], "--score-rgb": LEVEL_RGB[level], width: size, maxWidth: "100%" } as CSSProperties} role="img" aria-label={`${label}: ${value}/100`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="ex-score-ticks" cx="100" cy="100" r="97" pathLength="120" strokeDasharray="0.4 1.6" />
        <circle className="ex-score-track" cx="100" cy="100" r="84" />
        <circle className="ex-score-value" cx="100" cy="100" r="84" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - value} />
      </svg>
      <div aria-hidden="true">
        {animate ? <strong className="count-up" style={{ "--to": value } as CSSProperties} /> : <strong>{value}</strong>}
        <span>/ 100</span>
      </div>
    </div>
  );
}
