import { getMessages, translator, type Locale } from "@/lib/i18n";
import type { ReportDiff } from "@/lib/report/diff-core";

/** La comparacion (pura, con tests) vive en lib/report/diff-core.ts; aqui solo las frases del correo. */
export * from "@/lib/report/diff-core";

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
