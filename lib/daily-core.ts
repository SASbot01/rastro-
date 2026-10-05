// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Que hay de NUEVO en la comprobacion diaria (HIBP) frente a lo ya conocido.
 * Solo avisa de lo que de verdad es nuevo:
 *  - Si hoy no se pudieron mirar los volcados (HIBP con limite o caido), se conserva el numero anterior. Antes se
 *    guardaba 0 y al dia siguiente, al volver a funcionar, TODOS los volcados de siempre salian como "nuevos".
 *  - Sin nada con que comparar (primera comprobacion y el informe no pudo mirar HIBP), hoy es la linea base: sin aviso.
 *  - Con una comprobacion anterior, solo hay filtraciones nuevas si el total ha crecido, y como mucho tantas como
 *    haya crecido (la lista de nombres conocidos puede estar incompleta; el total no).
 */
export interface DailyInput {
  /** Nombres de las filtraciones de hoy. */
  names: string[];
  /** Volcados de hoy; null = hoy no se pudieron mirar. */
  pastes: number | null;
  /** Nombres ya conocidos (ultimo informe + avisos anteriores). */
  knownNames: string[];
  /** Total de filtraciones de la comprobacion anterior; null = no hay comprobacion anterior. */
  prevBreaches: number | null;
  /** Volcados conocidos; null = no se sabe. */
  knownPastes: number | null;
  /** El ultimo informe si pudo mirar HIBP (sus nombres valen como referencia). */
  reportChecked: boolean;
}

export function dailyOutcome(i: DailyInput): { newBreaches: string[]; newPastes: number; pastesToStore: number } {
  const known = new Set(i.knownNames);
  let newBreaches = i.names.filter((n) => !known.has(n));
  if (i.prevBreaches !== null) newBreaches = newBreaches.slice(0, Math.max(0, i.names.length - i.prevBreaches));
  else if (!i.reportChecked) newBreaches = [];
  const newPastes = i.pastes === null || i.knownPastes === null ? 0 : Math.max(0, i.pastes - i.knownPastes);
  return { newBreaches, newPastes, pastesToStore: i.pastes ?? i.knownPastes ?? 0 };
}
