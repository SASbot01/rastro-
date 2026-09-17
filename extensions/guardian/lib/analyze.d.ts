export interface CookieMeta { name: string; domain: string; expirationDate?: number; session?: boolean; secure?: boolean; httpOnly?: boolean; sameSite?: string }
export interface CookieReport {
  siteHost: string; bannerVisible: boolean; score: number; level: "green" | "orange" | "red";
  counts: { total: number; necessary: number; analytics: number; ads: number; broker: number; other: number; thirdParty: number; companies: number; maxDays: number };
  companies: Array<{ company: string; category: string }>;
  flags: Array<{ code: string; severity: string; n: number; years?: number }>;
  cookies: Array<{ name: string; domain: string; days: number; session: boolean; category: string; company: string | null; thirdParty: boolean }>;
}
export function analyzeCookies(input: { siteHost: string; cookies: CookieMeta[]; thirdPartyHosts?: string[]; bannerVisible?: boolean; now?: number; https?: boolean }): CookieReport;
export function summarize(report: CookieReport, locale?: string): string[];
export function baseDomain(host: string): string;
export function trackerFor(host: string): { company: string; category: string } | null;
export function classifyCookie(cookie: CookieMeta, siteHost: string): { company: string | null; category: string; thirdParty: boolean };
