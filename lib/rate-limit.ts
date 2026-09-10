import { supabaseAdmin } from "@/lib/supabase";
import { hashEmail, hashIp } from "@/lib/crypto";

/**
 * Limites de CLAUDE.md s.4: 3 informes por correo y dia, 20 por IP y dia.
 * La cuenta la lleva Postgres en una sola sentencia (bump_rate_limit), asi
 * dos peticiones simultaneas no pueden colarse. Solo se guardan hashes.
 */

const DAY_SECONDS = 24 * 60 * 60;
export const LIMITS = { email: 3, ip: 20 } as const;

async function bump(key: string, limit: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("bump_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: DAY_SECONDS,
  });
  if (error) {
    // Si el limite no se puede comprobar, mejor dejar pasar que bloquear a todos.
    console.error("[rate-limit] rpc fallo:", error.message);
    return true;
  }
  return data === true;
}

/** true si la peticion puede seguir; false si algun limite se ha superado. */
export async function allowRequest(email: string, ip: string): Promise<boolean> {
  if (process.env.RATE_LIMIT_DISABLED === "1" && process.env.NODE_ENV !== "production") return true;

  // La IP primero: es el limite mas amplio y frena bots antes de tocar el de correo.
  if (!(await bump(`ip:${hashIp(ip)}`, LIMITS.ip))) return false;
  if (!(await bump(`email:${hashEmail(email)}`, LIMITS.email))) return false;
  return true;
}
