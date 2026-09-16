/**
 * Score de exposicion — reglas de CLAUDE.md seccion 7.
 * Empieza en 100 y resta. Puro y determinista: mismas senales, mismo score.
 */

export interface ScoreSignals {
  breachesWithPassword: number;
  breachesWithoutPassword: number;
  publicProfiles: number;
  /** Dia 3 (IA): la IA acierta donde trabajas. */
  aiKnowsEmployer: boolean;
  /** Dia 3 (IA): la IA acierta la ciudad. */
  aiKnowsCity: boolean;
  /** Dia 3 (IA): telefono o direccion publicos confirmados. */
  contactDataPublic: boolean;
  /** Dia 3 (IA): la IA afirma cosas falsas sobre la persona. */
  aiFalseData: boolean;
}

export type Breakdown = Record<string, number>;

export type Level = "green" | "orange" | "red";

const RULES = {
  breachWithPassword: { each: -15, max: -45 },
  breachWithoutPassword: { each: -5, max: -15 },
  publicProfile: { each: -3, max: -15 },
  aiKnowsEmployer: -10,
  aiKnowsCity: -5,
  contactDataPublic: -15,
  aiFalseData: -5,
} as const;

function capped(count: number, rule: { each: number; max: number }): number {
  return Math.max(rule.max, count * rule.each);
}

export function computeScore(s: ScoreSignals): { score: number; breakdown: Breakdown } {
  const breakdown: Breakdown = {};

  if (s.breachesWithPassword > 0) {
    breakdown.breachWithPassword = capped(s.breachesWithPassword, RULES.breachWithPassword);
  }
  if (s.breachesWithoutPassword > 0) {
    breakdown.breachWithoutPassword = capped(s.breachesWithoutPassword, RULES.breachWithoutPassword);
  }
  if (s.publicProfiles > 0) {
    breakdown.publicProfile = capped(s.publicProfiles, RULES.publicProfile);
  }
  if (s.aiKnowsEmployer) breakdown.aiKnowsEmployer = RULES.aiKnowsEmployer;
  if (s.aiKnowsCity) breakdown.aiKnowsCity = RULES.aiKnowsCity;
  if (s.contactDataPublic) breakdown.contactDataPublic = RULES.contactDataPublic;
  if (s.aiFalseData) breakdown.aiFalseData = RULES.aiFalseData;

  const total = Object.values(breakdown).reduce((acc, n) => acc + n, 0);
  const score = Math.max(0, Math.min(100, 100 + total));
  return { score, breakdown };
}

/** Semaforo: 70-100 verde, 40-69 naranja, 0-39 rojo. */
export function levelFor(score: number): Level {
  if (score >= 70) return "green";
  if (score >= 40) return "orange";
  return "red";
}
