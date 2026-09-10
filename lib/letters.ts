import { getMessages, translator, type Locale } from "@/lib/i18n";
import { askPerplexity } from "@/lib/perplexity";

/**
 * Cartas de supresion RGPD (art. 17). Plantilla fija en messages/*.json
 * (texto legal revisable de una vez) con los datos del hallazgo. Perplexity
 * solo busca el contacto de privacidad del sitio; nunca redacta la carta.
 */

export interface LetterInput {
  fullName: string;
  email: string;
  city: string | null;
  host: string;
  url: string;
  /** Que datos aparecen (titulo del hallazgo). */
  what: string;
  locale: Locale;
}

export function buildLetter(input: LetterInput): { subject: string; body: string } {
  const tr = translator(getMessages(input.locale));
  const date = new Intl.DateTimeFormat(input.locale, { dateStyle: "long" }).format(new Date());
  const vars = {
    name: input.fullName,
    email: input.email,
    host: input.host,
    url: input.url,
    what: input.what,
    city: input.city ? `${input.city}, ` : "",
    date,
  };
  const body = [
    tr("letterTpl.date", vars),
    "",
    tr("letterTpl.salutation", vars),
    "",
    tr("letterTpl.p1", vars),
    "",
    tr("letterTpl.p2", vars),
    "",
    tr("letterTpl.p3", vars),
    "",
    tr("letterTpl.p4", vars),
    "",
    tr("letterTpl.p5", vars),
    "",
    tr("letterTpl.p6", vars),
    "",
    tr("letterTpl.closing", vars),
    input.fullName,
  ].join("\n");
  return { subject: tr("letterTpl.subject", vars), body };
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/**
 * Busca el correo o la URL de privacidad del sitio. Devuelve null si no hay
 * nada fiable: mejor "no lo sabemos" que un contacto inventado.
 */
export async function findPrivacyContact(
  host: string,
  locale: Locale,
): Promise<{ contact: string; source: string | null } | null> {
  const q =
    locale === "es"
      ? `¿Cuál es la dirección de correo electrónico oficial de privacidad, protección de datos o retirada de datos (opt out) del sitio ${host}? Responde solo con el correo o la URL exacta del formulario de retirada, y la página de donde lo sacas.`
      : `What is the official privacy, data protection or opt-out email address of the site ${host}? Answer only with the email or the exact opt-out form URL, and the page you got it from.`;
  const a = await askPerplexity(q, locale);
  if (!a) return null;

  const hostRoot = host.replace(/^www\./, "").split(".").slice(-2).join(".");
  const emails = (a.answer.match(EMAIL_RE) ?? []).filter((e) => e.toLowerCase().endsWith(hostRoot));
  if (emails.length > 0) {
    const src = a.sources.find((s) => s.url.includes(hostRoot))?.url ?? a.citations[0] ?? null;
    return { contact: emails[0], source: src };
  }
  // Sin correo: una URL del propio sitio que hable de privacidad/opt-out.
  const optOut = a.sources.find((s) => s.url.includes(hostRoot) && /privacy|privacidad|opt|remov|delete|supres/i.test(s.url + s.title));
  return optOut ? { contact: optOut.url, source: optOut.url } : null;
}
