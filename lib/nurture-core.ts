// Modulo puro (sin imports con alias) para poder probarlo con node --test.
export const NURTURE_STEPS = [
  { step: 1, afterDays: 1 },
  { step: 2, afterDays: 3 },
  { step: 3, afterDays: 7 },
] as const;

/** Paso que toca enviar ahora (o null). Puro: fecha del primer informe, ultimo paso enviado y cuando. */
export function dueStep(firstReportAt: Date, lastStep: number, now = new Date()): 1 | 2 | 3 | null {
  const next = NURTURE_STEPS.find((s) => s.step === lastStep + 1);
  if (!next) return null;
  const dueAt = firstReportAt.getTime() + next.afterDays * 86_400_000;
  return now.getTime() >= dueAt ? next.step : null;
}
