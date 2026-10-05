/**
 * Comunidad / foro de Rastro — lógica pura (sin red ni BD), con tests.
 * Valida y limpia lo que la gente escribe. El texto se guarda en PLANO y se
 * pinta como texto (nunca HTML) para que no haya forma de inyectar código.
 */

export const FORUM_TAGS = ["general", "estafas", "contrasenas", "privacidad", "ayuda", "noticias"] as const;
export type ForumTag = (typeof FORUM_TAGS)[number];

export const TITLE_MAX = 140;
export const TITLE_MIN = 3;
export const BODY_MAX = 5000;

export function isValidTag(tag: unknown): tag is ForumTag {
  return typeof tag === "string" && (FORUM_TAGS as readonly string[]).includes(tag);
}

/** Nombre que se muestra: el que la persona puso, o la parte antes de la @. Nunca el correo entero. */
export function displayName(user: { display_name: string | null; email: string }): string {
  const n = user.display_name?.trim();
  if (n) return n.slice(0, 40);
  return user.email.split("@")[0].slice(0, 40);
}

/** Limpia texto: quita controles, recorta, y colapsa 3+ saltos de línea en 2. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  // eslint-disable-next-line no-control-regex
  const noCtrl = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return noCtrl.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, max);
}

export type ThreadInput = { title?: unknown; body?: unknown; tag?: unknown };
export type ThreadValid = { ok: true; title: string; body: string; tag: ForumTag };
export type Invalid = { ok: false; error: "title_short" | "title_long" | "body_empty" };

export function validateThread(input: ThreadInput): ThreadValid | Invalid {
  const title = cleanText(input.title, TITLE_MAX + 1);
  const body = cleanText(input.body, BODY_MAX);
  if (title.length < TITLE_MIN) return { ok: false, error: "title_short" };
  if (title.length > TITLE_MAX) return { ok: false, error: "title_long" };
  if (body.length < 1) return { ok: false, error: "body_empty" };
  const tag: ForumTag = isValidTag(input.tag) ? input.tag : "general";
  return { ok: true, title, body, tag };
}

export type ReplyValid = { ok: true; body: string };
export function validateReply(input: { body?: unknown }): ReplyValid | { ok: false; error: "body_empty" } {
  const body = cleanText(input.body, BODY_MAX);
  if (body.length < 1) return { ok: false, error: "body_empty" };
  return { ok: true, body };
}
