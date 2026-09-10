import type { HibpResult } from "@/lib/hibp";
import type { GravatarResult } from "@/lib/gravatar";

/**
 * "Cuentas conocidas con este correo": deducidas de datos legitimos, sin
 * sondear servicios de terceros. Cada filtracion demuestra que el correo
 * tenia cuenta en ese servicio; Gravatar aporta las redes que la persona
 * enlazo publicamente a su correo.
 */
export interface KnownAccount {
  name: string;
  domain: string | null;
  url: string | null;
  /** breach: aparecio en una filtracion; gravatar: enlazada en el perfil publico */
  source: "breach" | "gravatar";
  /** YYYY-MM-DD de la filtracion, si aplica */
  date: string | null;
  hasPassword: boolean;
}

export function buildAccounts(hibp: HibpResult, gravatar: GravatarResult): KnownAccount[] {
  const out: KnownAccount[] = [];
  const seen = new Set<string>();

  if (hibp.checked) {
    for (const b of hibp.breaches) {
      // Las listas agregadas (stealer logs, recopilaciones) no son "una cuenta en X".
      if (b.isStealerLog || !b.domain) continue;
      const key = b.domain.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: b.title, domain: b.domain, url: `https://${b.domain}`, source: "breach", date: b.date, hasPassword: b.hasPassword });
    }
  }

  if (gravatar.checked && gravatar.profile) {
    for (const a of gravatar.profile.accounts) {
      let domain: string | null = null;
      try {
        domain = new URL(a.url).hostname.replace(/^www\./, "");
      } catch {
        /* url rara: se lista sin dominio */
      }
      const key = (domain ?? a.url).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: a.shortname || domain || a.url, domain, url: a.url, source: "gravatar", date: null, hasPassword: false });
    }
  }

  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
