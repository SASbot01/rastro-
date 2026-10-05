// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * IP del visitante para los limites de uso.
 *
 * Produccion va detras de Cloudflare (tunel). Cloudflare NO borra un
 * `X-Forwarded-For` que traiga el visitante: le AÑADE la IP real al final. El
 * primer valor de esa cabecera lo elige, por tanto, quien hace la peticion, y
 * con un valor distinto cada vez se saltaba todos los limites por IP (informes,
 * chat, guardian, acceso). `CF-Connecting-IP` la pone Cloudflare y el visitante
 * no puede falsificarla. En Vercel no hay Cloudflare delante y esa cabecera si
 * llegaria tal cual del visitante: alli se ignora y manda X-Forwarded-For, que
 * Vercel sobrescribe.
 */
export interface HeaderBag { get(name: string): string | null }

export function clientIpFrom(h: HeaderBag, env: Record<string, string | undefined> = process.env): string {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf && !env.VERCEL) return cf;
  const forwarded = h.get("x-forwarded-for")?.split(",")[0].trim();
  if (forwarded) return forwarded;
  return h.get("x-real-ip")?.trim() || "0.0.0.0";
}
