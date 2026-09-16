import es from "@/messages/es.json";
import en from "@/messages/en.json";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "rastro_locale";

/** Los diccionarios comparten forma; `es` es la referencia de tipos. */
export type Messages = typeof es;

const DICTIONARIES: Record<Locale, Messages> = { es, en: en as Messages };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

/**
 * Elige idioma a partir de la cabecera Accept-Language.
 * "es" por defecto; "en" solo si el navegador lo prefiere claramente.
 */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.split("=")[1]) : 1;
      return { tag: tag.trim().toLowerCase(), quality: Number.isNaN(quality) ? 0 : quality };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (base === "es") return "es";
    if (base === "en") return "en";
  }
  return DEFAULT_LOCALE;
}

/**
 * Devuelve un texto del diccionario por su ruta con puntos e interpola {claves}.
 * t(m, "sent.body", { email: "a@b.com" })
 */
export function t(
  messages: Messages,
  path: string,
  vars?: Record<string, string | number>,
): string {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), messages);

  if (typeof value !== "string") {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] falta la clave "${path}"`);
    }
    return path;
  }
  if (!vars) return value;

  return value.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** Crea un traductor ligado a un diccionario. */
export function translator(messages: Messages) {
  return (path: string, vars?: Record<string, string | number>) => t(messages, path, vars);
}
