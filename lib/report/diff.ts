import { getMessages, translator, type Locale } from "@/lib/i18n";

/**
 * Diferencias entre dos informes de la misma persona, con senales
 * deterministas (no con el texto de la IA, que cambia en cada redaccion):
 * filtraciones, perfiles atribuidos, sitios de venta de datos, senales de
 * la IA y score. Sirve para el correo mensual de novedades.
 */

interface RawShape {
  hibp?: { checked: boolean; breaches?: Array<{ name: string; title: string }> };
  brave?: { ok: boolean; hits?: Array<{ url: string; hostname: string; kind: string }> };
  ai?: {
    signals?: { knows_employer: boolean; knows_city: boolean; contact_data_public: boolean; false_claims: boolean };
    attributed_profile_urls?: string[];
  };
}

export interface ReportSnapshot {
  score: number;
  raw: RawShape | null;
}

type SignalKey = "knows_employer" | "knows_city" | "contact_data_public" | "false_claims";
const SIGNAL_KEYS: SignalKey[] = ["knows_employer", "knows_city", "contact_data_public", "false_claims"];

export interface ReportDiff {
  changed: boolean;
  score_before: number;
  score_after: number;
  new_breaches: string[];
  gone_breaches: string[];
  new_profiles: string[];
  gone_profiles: string[];
  new_brokers: string[];
  gone_brokers: string[];
  signals_on: SignalKey[];
  signals_off: SignalKey[];
}

function breachNames(r: RawShape | null): Set<string> {
  return new Set(r?.hibp?.checked ? (r.hibp.breaches ?? []).map((b) => b.title || b.name) : []);
}
function profileUrls(r: RawShape | null): Set<string> {
  return new Set(r?.ai?.attributed_profile_urls ?? []);
}
function brokerHosts(r: RawShape | null): Set<string> {
  return new Set(r?.brave?.ok ? (r.brave.hits ?? []).filter((h) => h.kind === "broker").map((h) => h.hostname.replace(/^www\./, "")) : []);
}
function onlyIn<T>(a: Set<T>, b: Set<T>): T[] {
  return [...a].filter((x) => !b.has(x));
}

export function diffReports(prev: ReportSnapshot, next: ReportSnapshot): ReportDiff {
  const pb = breachNames(prev.raw), nb = breachNames(next.raw);
  const pp = profileUrls(prev.raw), np = profileUrls(next.raw);
  const pk = brokerHosts(prev.raw), nk = brokerHosts(next.raw);
  const ps = prev.raw?.ai?.signals, ns = next.raw?.ai?.signals;

  const d: ReportDiff = {
    changed: false,
    score_before: prev.score,
    score_after: next.score,
    new_breaches: onlyIn(nb, pb),
    gone_breaches: onlyIn(pb, nb),
    new_profiles: onlyIn(np, pp),
    gone_profiles: onlyIn(pp, np),
    new_brokers: onlyIn(nk, pk),
    gone_brokers: onlyIn(pk, nk),
    // Las senales solo cuentan si ambos informes las tienen (si no, no hay con que comparar).
    signals_on: ps && ns ? SIGNAL_KEYS.filter((k) => !ps[k] && ns[k]) : [],
    signals_off: ps && ns ? SIGNAL_KEYS.filter((k) => ps[k] && !ns[k]) : [],
  };
  d.changed =
    d.new_breaches.length + d.gone_breaches.length + d.new_profiles.length + d.gone_profiles.length +
      d.new_brokers.length + d.gone_brokers.length + d.signals_on.length + d.signals_off.length > 0 ||
    // La redaccion de la IA introduce ruido: un cambio solo de score cuenta si es grande.
    Math.abs(d.score_after - d.score_before) >= 15;
  return d;
}

/** Lineas del correo, ya traducidas y ordenadas de mas a menos importante. */
export function diffLines(d: ReportDiff, locale: Locale): string[] {
  const tr = translator(getMessages(locale));
  const lines: string[] = [];
  lines.push(
    d.score_after === d.score_before
      ? tr("monitorEmail.scoreSame", { after: d.score_after })
      : tr("monitorEmail.scoreChange", { before: d.score_before, after: d.score_after }),
  );
  for (const n of d.new_breaches) lines.push(tr("monitorEmail.newBreach", { name: n }));
  for (const h of d.new_brokers) lines.push(tr("monitorEmail.newBroker", { host: h }));
  for (const k of d.signals_on) lines.push(tr("monitorEmail.signalOn", { what: tr(`monitorEmail.signals.${k}`) }));
  for (const u of d.new_profiles) lines.push(tr("monitorEmail.newProfile", { url: u }));
  for (const n of d.gone_breaches) lines.push(tr("monitorEmail.goneBreach", { name: n }));
  for (const h of d.gone_brokers) lines.push(tr("monitorEmail.goneBroker", { host: h }));
  for (const k of d.signals_off) lines.push(tr("monitorEmail.signalOff", { what: tr(`monitorEmail.signals.${k}`) }));
  for (const u of d.gone_profiles) lines.push(tr("monitorEmail.goneProfile", { url: u }));
  return lines;
}
