import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  localeFromAcceptLanguage,
  type Locale,
} from "@/lib/i18n";

/**
 * Idioma efectivo: la elección explícita del usuario (cookie) manda sobre
 * la preferencia del navegador.
 */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const accept = (await headers()).get("accept-language");
  return localeFromAcceptLanguage(accept) ?? DEFAULT_LOCALE;
}
