import { supabaseAdmin } from "@/lib/supabase";
import { hashEmail, hashIp } from "@/lib/crypto";

/**
 * Limites por uso. Informes: 3 por correo y dia, 20 por IP y dia (CLAUDE.md s.4).
 * Entrar y soporte tienen su propio contador, mas holgado: pedir un codigo de
 * acceso varias veces no debe bloquear a nadie por haber pedido informes.
 * La cuenta la lleva Postgres en una sola sentencia (bump_rate_limit), asi
 * dos peticiones simultaneas no pueden colarse. Solo se guardan hashes.
 */

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export type RateKind = "report" | "login" | "support" | "ask" | "guardian" | "api" | "api_ai";

export const LIMITS: Record<RateKind, { email: number; ip: number; window: number }> = {
  report: { email: 3, ip: 20, window: DAY },
  login: { email: 10, ip: 60, window: HOUR },
  support: { email: 5, ip: 30, window: DAY },
  ask: { email: 0, ip: 40, window: DAY }, // chat del muneco: solo por IP
  guardian: { email: 0, ip: 5, window: DAY }, // "¿es una estafa?" gratis: 5 al dia por IP (Pro sin limite)
  api: { email: 0, ip: 1000, window: DAY }, // API publica: peticiones por clave y dia
  api_ai: { email: 0, ip: 100, window: DAY }, // API publica: peticiones que usan IA, por clave y dia
};

async function bump(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("bump_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Si el limite no se puede comprobar, mejor dejar pasar que bloquear a todos.
    console.error("[rate-limit] rpc fallo:", error.message);
    return true;
  }
  return data === true;
}

/** true si la peticion puede seguir; false si algun limite se ha superado. */
export async function allowRequest(email: string, ip: string, kind: RateKind = "report"): Promise<boolean> {
  if (process.env.RATE_LIMIT_DISABLED === "1" && process.env.NODE_ENV !== "production") return true;

  const { email: emailLimit, ip: ipLimit, window } = LIMITS[kind];
  // Los informes conservan las claves originales; el resto lleva prefijo propio.
  const prefix = kind === "report" ? "" : `${kind}:`;
  // La IP primero: es el limite mas amplio y frena bots antes de tocar el de correo.
  if (!(await bump(`${prefix}ip:${hashIp(ip)}`, ipLimit, window))) return false;
  if (!(await bump(`${prefix}email:${hashEmail(email)}`, emailLimit, window))) return false;
  return true;
}

/** Limite solo por IP (peticiones sin correo, como el chat de la portada). */
export async function allowByIp(ip: string, kind: RateKind): Promise<boolean> {
  if (process.env.RATE_LIMIT_DISABLED === "1" && process.env.NODE_ENV !== "production") return true;
  const { ip: ipLimit, window } = LIMITS[kind];
  return bump(`${kind}:ip:${hashIp(ip)}`, ipLimit, window);
}

/** Limite por clave de API (o cualquier identificador estable). */
export async function allowByKey(id: string, kind: RateKind): Promise<boolean> {
  const { ip: limit, window } = LIMITS[kind];
  return bump(`${kind}:key:${hashIp(id)}`, limit, window);
}
