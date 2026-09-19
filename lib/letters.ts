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

export type LetterEventType = "sent" | "sent_by_rastro" | "follow_up" | "reminder" | "answered" | "closed" | "no_answer" | "reopened" | "verified_gone" | "reappeared";
export interface LetterEvent {
  at: string;
  type: LetterEventType;
  to?: string;
  note?: string;
}

/** Anade un evento a la cronologia de la carta (inmutable: devuelve la lista nueva). */
export function withEvent(events: LetterEvent[] | null | undefined, event: Omit<LetterEvent, "at">): LetterEvent[] {
  return [...(events ?? []), { at: new Date().toISOString(), ...event }];
}

/** Recordatorio (segunda solicitud): intro con fechas + la carta original. */
export function buildFollowUp(input: { fullName: string; locale: Locale; sentAt: string; deadlineAt: string; subject: string; body: string }): { subject: string; body: string } {
  const tr = translator(getMessages(input.locale));
  const fmt = new Intl.DateTimeFormat(input.locale, { dateStyle: "long" });
  const vars = { name: input.fullName, sent: fmt.format(new Date(input.sentAt)), deadline: fmt.format(new Date(input.deadlineAt)) };
  return {
    subject: tr("letterTpl.followUpSubject", vars),
    body: [tr("letterTpl.followUpIntro", vars), "", "----------", "", input.body].join("\n"),
  };
}

export interface ComplaintInput extends LetterInput {
  contact: string | null;
  sentAt: string;
  deadlineAt: string;
  /** Fecha del recordatorio enviado por Rastro, si lo hubo. */
  followUpAt?: string | null;
  /** Respuesta del sitio (si se negaron) y su resultado. */
  replyNote?: string | null;
  outcome?: "deleted" | "refused" | "partial" | null;
}

/** Escrito de reclamacion ante la AEPD (art. 77 RGPD) a partir de una carta sin respuesta. */
export function buildComplaint(input: ComplaintInput): string {
  const tr = translator(getMessages(input.locale));
  const fmt = new Intl.DateTimeFormat(input.locale, { dateStyle: "long" });
  const vars = {
    name: input.fullName,
    email: input.email,
    host: input.host,
    url: input.url,
    what: input.what,
    city: input.city ? (input.locale === "es" ? `, con domicilio en ${input.city}` : `, residing in ${input.city}`) : "",
    city2: input.city ? `${input.city}, ` : "",
    contact: input.contact ? ` (${input.contact})` : "",
    sent: fmt.format(new Date(input.sentAt)),
    deadline: fmt.format(new Date(input.deadlineAt)),
    followUp: input.followUpAt ? fmt.format(new Date(input.followUpAt)) : "",
    date: fmt.format(new Date()),
  };
  const t = (k: string) => tr(`aepdTpl.${k}`, vars);
  const refused = input.outcome === "refused" && input.replyNote;
  const facts = [t("f1"), t("f2") + (input.followUpAt ? " " + t("f2b") : ""), refused ? t("f3refused") : t("f3")];
  const docs = [t("d1"), t("d2"), ...(input.followUpAt ? [t("d3")] : []), ...(refused ? [t("d4")] : [])];
  return [
    t("title"), "",
    t("claimant"), t("respondent"), "",
    t("factsTitle"), ...facts, "",
    t("lawTitle"), t("l1"), "",
    t("requestTitle"), t("r1"), "",
    t("docsTitle"), ...docs, "",
    ...(refused ? [tr("letters.replyNote") + ":", input.replyNote!, ""] : []),
    t("signoff"), t("signature"),
  ].join("\n");
}


/** Quita acentos y pasa a minusculas para comparar nombres con el texto de una pagina. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Descarga la URL y busca el nombre. listed: true = sigue apareciendo; false =
 * ya no; null = no se pudo comprobar (bloqueo, error, pagina que exige JS/pago).
 * httpGone: la pagina ya no existe (404/410), la prueba mas fuerte de retirada.
 */
export async function checkListing(url: string, fullName: string): Promise<{ listed: boolean | null; httpGone: boolean }> {
  const parts = fold(fullName).split(/\s+/).filter((p) => p.length > 2);
  if (parts.length === 0) return { listed: null, httpGone: false };
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; RastroBot/1.0; +https://rastropro.com)", accept: "text/html,*/*" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 410) return { listed: false, httpGone: true };
    if (!res.ok) return { listed: null, httpGone: false };
    const html = await res.text();
    const text = fold(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
    if (text.length < 200) return { listed: null, httpGone: false };
    // Apellidos + nombre: todos los trozos del nombre deben aparecer.
    return { listed: parts.every((p) => text.includes(p)), httpGone: false };
  } catch {
    return { listed: null, httpGone: false };
  }
}

/** Compatibilidad: solo el booleano. */
export async function checkStillListed(url: string, fullName: string): Promise<boolean | null> {
  return (await checkListing(url, fullName)).listed;
}
