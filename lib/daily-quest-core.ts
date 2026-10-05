/**
 * Reto diario de privacidad + racha (retención) — lógica pura, con tests.
 *
 * El contenido de los retos (texto) vive en messages/*.json (dash.questBank),
 * así que aquí solo decidimos QUÉ reto toca hoy (determinista por fecha) y cómo
 * evoluciona la racha. Nada de red ni BD.
 */

export interface QuestState {
  streak: number; // racha actual (días seguidos) tal como se ve hoy
  best: number; // récord
  doneToday: boolean; // ya completado hoy
  index: number; // posición del reto de hoy en el banco
}

/** Día (YYYY-MM-DD) en la zona de España, la del producto y el cron. */
export function madridDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** El día anterior a una fecha YYYY-MM-DD (cálculo en UTC, estable). */
export function previousDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) - 86_400_000;
  const dt = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** Número de día absoluto desde epoch (para elegir el reto de forma determinista). */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Índice del reto de hoy en un banco de `len` retos (mismo para todo el mundo). */
export function questIndexForDay(iso: string, len: number): number {
  if (len <= 0) return 0;
  const n = dayNumber(iso);
  return ((n % len) + len) % len;
}

/**
 * Estado de la racha tal como se MUESTRA hoy, sin tocar nada todavía.
 * La racha "sigue viva" si el último día hecho fue hoy o ayer; si no, está a 0.
 */
export function viewState(prevStreak: number, prevBest: number, prevLast: string | null, today: string, len: number): QuestState {
  const yesterday = previousDay(today);
  const alive = prevLast === today || prevLast === yesterday;
  return {
    streak: alive ? prevStreak : 0,
    best: prevBest,
    doneToday: prevLast === today,
    index: questIndexForDay(today, len),
  };
}

export interface StreakResult { streak: number; best: number; last: string; already: boolean }

/**
 * Transición al completar el reto de hoy. Pura y determinista:
 * - si ya estaba hecho hoy → no cambia (already=true)
 * - si el último fue ayer → +1
 * - si no → la racha vuelve a empezar en 1
 */
export function completeToday(prevStreak: number, prevBest: number, prevLast: string | null, today: string): StreakResult {
  const yesterday = previousDay(today);
  if (prevLast === today) {
    const streak = Math.max(prevStreak, 1);
    return { streak, best: Math.max(prevBest, streak), already: true, last: today };
  }
  const streak = prevLast === yesterday ? prevStreak + 1 : 1;
  return { streak, best: Math.max(prevBest, streak), already: false, last: today };
}
