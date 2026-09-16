/** All health signals, including monitoring, require the same sharing opt-in. */
export function sharedMonitoring(member: { org_share_at: string | null; monitoring: boolean }): boolean | null {
  return member.org_share_at ? member.monitoring : null;
}

/** Quote CSV and neutralize spreadsheet formulas in user-controlled fields. */
export function csvCell(value: string): string {
  const safe = /^[\s]*[=+@\-\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
