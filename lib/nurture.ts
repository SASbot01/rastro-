import { hmac, safeEqual } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";

/**
 * Secuencia de tres correos tras el primer informe (dia 1, 3 y 7). Son
 * correos del propio servicio que la persona pidio, con enlace para dejar de
 * recibirlos en cada uno. Nunca se envian a cuentas Pro ni a quien paro la
 * secuencia. Las plantillas viven en messages.nurture.
 */
export { NURTURE_STEPS, dueStep } from "@/lib/nurture-core";

/** Enlace firmado para parar la secuencia sin iniciar sesion: el usuario no tiene que recordar nada. */
export function stopToken(userId: string): string {
  return hmac(`nurture-stop:${userId}`).slice(0, 32);
}
export function stopUrl(userId: string): string {
  return `${serverEnv.siteUrl}/api/nurture/stop?u=${encodeURIComponent(userId)}&t=${stopToken(userId)}`;
}
export function validStopToken(userId: string, token: string): boolean {
  return safeEqual(stopToken(userId), token);
}

