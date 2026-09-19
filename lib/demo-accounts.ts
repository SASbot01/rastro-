// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Cuentas de demostracion: datos preparados a mano (deploy/demo/*.sql) con URL
 * inventadas, para grabar videos. Un cron que las procese de verdad estropea la
 * demo: la recomprobacion de cartas descargaria esas URL falsas, recibiria un
 * 404 y daria el dato por "retirado" (con correo incluido).
 * Lista en CRON_SKIP_EMAILS (separada por comas); por defecto, la cuenta demo.
 */
export function cronSkipEmails(env: Record<string, string | undefined> = process.env): Set<string> {
  const raw = env.CRON_SKIP_EMAILS ?? "demo@rastropro.com";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export function isCronSkipped(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(email) && cronSkipEmails(env).has(String(email).trim().toLowerCase());
}
