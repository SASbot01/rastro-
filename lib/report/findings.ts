import type { Breach, HibpResult } from "@/lib/hibp";
import type { BraveResult, SearchHit } from "@/lib/brave";
import { getMessages, translator, type Locale, type Messages } from "@/lib/i18n";
import type { ScoreSignals } from "@/lib/report/score";

/**
 * Convierte los datos crudos (HIBP, Brave) en hallazgos, resumen y acciones
 * en el idioma del usuario. Sin IA todavia: texto de plantilla (Dia 2).
 * El Dia 3 anade la categoria "ai" y reescribe con Anthropic.
 */

export type Category = "breaches" | "ai" | "profiles" | "false";
export type Severity = "high" | "medium" | "low" | "info";

export interface Finding {
  category: Category;
  title: string;
  detail: string;
  source_url: string | null;
  severity: Severity;
}

export interface Action {
  title: string;
  detail: string;
}

export interface ReportInputs {
  hibp: HibpResult;
  brave: BraveResult;
  locale: Locale;
}

const MAX_PROFILE_FINDINGS = 5;
const MAX_BROKER_FINDINGS = 3;
const MAX_PAGE_FINDINGS = 3;
const MAX_DATA_CLASSES = 4;

function dataClassesText(breach: Breach, messages: Messages): string {
  const dict = messages.dataClasses as Record<string, string>;
  // Contrasenas primero: es lo que importa.
  const ordered = [...breach.dataClasses].sort((a, b) =>
    /password/i.test(a) === /password/i.test(b) ? 0 : /password/i.test(a) ? -1 : 1,
  );
  return ordered
    .slice(0, MAX_DATA_CLASSES)
    .map((c) => dict[c] ?? c.toLowerCase())
    .join(", ");
}

function year(date: string): string {
  return date.slice(0, 4);
}

export function buildFindings({ hibp, brave, locale }: ReportInputs): Finding[] {
  const messages = getMessages(locale);
  const tr = translator(messages);
  const out: Finding[] = [];

  // --- Filtraciones -----------------------------------------------------
  if (!hibp.checked) {
    out.push({
      category: "breaches",
      title: tr("findings.breachUncheckedTitle"),
      detail: tr("findings.breachUncheckedDetail"),
      source_url: null,
      severity: "info",
    });
  } else if (hibp.breaches.length === 0) {
    out.push({
      category: "breaches",
      title: tr("findings.noBreachesTitle"),
      detail: tr("findings.noBreachesDetail"),
      source_url: null,
      severity: "info",
    });
  } else {
    for (const b of hibp.breaches) {
      const vars = { name: b.title, year: year(b.date), data: dataClassesText(b, messages) };
      out.push({
        category: "breaches",
        title: tr(b.hasPassword ? "findings.breachPasswordTitle" : "findings.breachTitle", vars),
        detail: tr(b.hasPassword ? "findings.breachPasswordDetail" : "findings.breachDetail", vars),
        source_url: b.domain ? `https://${b.domain}` : null,
        severity: b.hasPassword ? "high" : "medium",
      });
    }
  }

  // --- Perfiles y paginas publicas ---------------------------------------
  if (!brave.ok) {
    out.push({
      category: "profiles",
      title: tr("findings.searchFailedTitle"),
      detail: tr("findings.searchFailedDetail"),
      source_url: null,
      severity: "info",
    });
    return out;
  }

  const profiles = brave.hits.filter((h) => h.kind === "profile").slice(0, MAX_PROFILE_FINDINGS);
  const brokers = brave.hits.filter((h) => h.kind === "broker").slice(0, MAX_BROKER_FINDINGS);
  const pages = brave.hits.filter((h) => h.kind === "page").slice(0, MAX_PAGE_FINDINGS);

  for (const h of profiles) {
    out.push({
      category: "profiles",
      title: tr("findings.profileTitle", { platform: h.platform ?? h.hostname }),
      detail: tr("findings.profileDetail", { title: h.title }),
      source_url: h.url,
      severity: "medium",
    });
  }
  for (const h of brokers) {
    out.push({
      category: "profiles",
      title: tr("findings.brokerTitle", { host: h.hostname.replace(/^www\./, "") }),
      detail: tr("findings.brokerDetail"),
      source_url: h.url,
      severity: "high",
    });
  }
  for (const h of pages) {
    out.push({
      category: "profiles",
      title: tr("findings.pageTitle", { title: h.title }),
      detail: tr("findings.pageDetail", { host: h.hostname.replace(/^www\./, "") }),
      source_url: h.url,
      severity: "low",
    });
  }
  if (profiles.length + brokers.length + pages.length === 0) {
    out.push({
      category: "profiles",
      title: tr("findings.noResultsTitle"),
      detail: tr("findings.noResultsDetail"),
      source_url: null,
      severity: "info",
    });
  }

  return out;
}

export function buildSummary({ hibp, brave, locale }: ReportInputs): string {
  const tr = translator(getMessages(locale));
  const parts: string[] = [];

  if (!hibp.checked) {
    parts.push(tr("summary.breachesUnchecked"));
  } else {
    const n = hibp.breaches.length;
    const pwCount = hibp.breaches.filter((b) => b.hasPassword).length;
    const pw =
      pwCount === 0 ? "" : n === 1 ? tr("summary.withPassword") : tr("summary.withPasswordN", { n: pwCount });
    parts.push(
      n === 0 ? tr("summary.breachesNone") : n === 1 ? tr("summary.breachesOne", { pw }) : tr("summary.breachesMany", { n, pw }),
    );
  }

  if (!brave.ok) {
    parts.push(tr("summary.searchFailed"));
  } else {
    const profiles = brave.hits.filter((h) => h.kind === "profile").length;
    const brokers = brave.hits.filter((h) => h.kind === "broker").length;
    parts.push(
      profiles === 0 ? tr("summary.profilesNone") : profiles === 1 ? tr("summary.profilesOne") : tr("summary.profilesMany", { n: profiles }),
    );
    if (brokers > 0) parts[parts.length - 1] += tr("summary.brokers", { n: brokers });
  }

  return parts.join(" ");
}

export function buildActions({ hibp, brave, locale }: ReportInputs): Action[] {
  const tr = translator(getMessages(locale));
  const out: Action[] = [];

  const pwBreach = hibp.checked ? hibp.breaches.find((b) => b.hasPassword) : undefined;
  const anyBreach = hibp.checked && hibp.breaches.length > 0;
  const hasProfiles = brave.ok && brave.hits.some((h) => h.kind === "profile");
  const hasBrokers = brave.ok && brave.hits.some((h) => h.kind === "broker");

  if (pwBreach) {
    out.push({
      title: tr("actionsTpl.changePasswordTitle"),
      detail: tr("actionsTpl.changePasswordDetail", { name: pwBreach.title }),
    });
  }
  if (anyBreach) {
    out.push({ title: tr("actionsTpl.twoFactorTitle"), detail: tr("actionsTpl.twoFactorDetail") });
  }
  if (hasBrokers) {
    out.push({ title: tr("actionsTpl.brokerOptOutTitle"), detail: tr("actionsTpl.brokerOptOutDetail") });
  }
  if (hasProfiles) {
    out.push({ title: tr("actionsTpl.reviewProfilesTitle"), detail: tr("actionsTpl.reviewProfilesDetail") });
  }
  // Relleno hasta 3 con consejos siempre validos.
  out.push({ title: tr("actionsTpl.passwordManagerTitle"), detail: tr("actionsTpl.passwordManagerDetail") });
  out.push({ title: tr("actionsTpl.monitorTitle"), detail: tr("actionsTpl.monitorDetail") });

  return out.slice(0, 3);
}

/** Senales que extrae la IA (lib/ai/report.ts). Sin IA, todas a false. */
export interface AiSignals {
  knows_employer: boolean;
  knows_city: boolean;
  contact_data_public: boolean;
  false_claims: boolean;
}

/** Senales para el score: deterministas (HIBP/Brave) + las de la IA si las hay. */
export function signalsFrom(
  hibp: HibpResult,
  brave: BraveResult,
  ai?: AiSignals,
  /** Perfiles que la IA atribuye a la persona. Si se conoce, manda sobre el recuento bruto de Brave. */
  attributedProfiles?: number,
  /** Volcados publicos (pastes) con el correo: cuentan como filtracion sin contrasena. */
  pastes = 0,
): ScoreSignals {
  const breaches = hibp.checked ? hibp.breaches : [];
  const hits: SearchHit[] = brave.ok ? brave.hits : [];
  return {
    breachesWithPassword: breaches.filter((b) => b.hasPassword).length,
    breachesWithoutPassword: breaches.filter((b) => !b.hasPassword).length + pastes,
    publicProfiles: attributedProfiles ?? hits.filter((h) => h.kind === "profile").length,
    aiKnowsEmployer: ai?.knows_employer ?? false,
    aiKnowsCity: ai?.knows_city ?? false,
    contactDataPublic: ai?.contact_data_public ?? false,
    aiFalseData: ai?.false_claims ?? false,
  };
}
