import { getMessages, translator, type Locale } from "@/lib/i18n";
import type { AiChange } from "@/lib/ai-watch-core";

/** Frase llana para cada cambio ("ChatGPT ahora dice donde trabajas: Acme"). */
export function changeLine(c: AiChange, locale: Locale): string {
  const tr = translator(getMessages(locale));
  const ai = tr(`aiWatch.providers.${c.provider}`);
  const contact = (k: string | null) => (k ? tr(`aiWatch.contact.${k}`) : "");
  const vars = { ai, before: c.kind.startsWith("contact") ? contact(c.before) : (c.before ?? ""), after: c.kind.startsWith("contact") ? contact(c.after) : (c.after ?? "") };
  return tr(`aiWatch.change.${c.kind}`, vars);
}

export function changeLines(changes: AiChange[], locale: Locale, opts: { includeMinor?: boolean } = {}): string[] {
  return changes.filter((c) => opts.includeMinor || !c.minor).map((c) => changeLine(c, locale));
}
