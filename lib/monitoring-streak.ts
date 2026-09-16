export interface DailyCheck { day: string; status: "ok" | "alert" | "error" }

/** Consecutive successful checks. Yesterday is accepted while today's job is pending. */
export function monitoringStreak(checks: DailyCheck[], today: string): number {
  const days = new Map<string, DailyCheck["status"]>();
  for (const check of checks) {
    // Conflicting duplicates must never manufacture a clean day.
    const previous = days.get(check.day);
    if (!previous || previous === "ok") days.set(check.day, check.status);
  }
  let date = new Date(`${today}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return 0;
  if (!days.has(today)) date = new Date(date.getTime() - 86_400_000);
  let streak = 0;
  while (days.get(date.toISOString().slice(0, 10)) === "ok") {
    streak++;
    date = new Date(date.getTime() - 86_400_000);
  }
  return streak;
}
