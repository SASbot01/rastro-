import type { Finding, Category } from "./findings";

export const CATEGORIES: Category[] = ["breaches", "ai", "profiles", "false"];

/** Informational placeholders (including unavailable providers) aren't discoveries. */
export function actionableFindings(findings: Finding[]) {
  return findings.filter((finding) => finding.severity !== "info");
}

/** Only explicit HTTP(S) source links can become interactive UI. */
export function safeSource(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function sourceHost(value: string | null | undefined): string | null {
  const url = safeSource(value);
  return url ? new URL(url).hostname.replace(/^www\./, "") : null;
}

export function reportCounts(findings: Finding[]) {
  const visible = actionableFindings(findings);
  return {
    total: visible.length,
    sources: new Set(visible.map((f) => sourceHost(f.source_url)).filter(Boolean)).size,
    categories: Object.fromEntries(CATEGORIES.map((c) => [c, visible.filter((f) => f.category === c).length])) as Record<Category, number>,
  };
}

/** Export payload deliberately excludes names, URLs, providers and free text. */
export function captureSummary(score: number, findings: Finding[]) {
  return { score: Math.max(0, Math.min(100, Math.round(score))), ...reportCounts(findings) };
}
