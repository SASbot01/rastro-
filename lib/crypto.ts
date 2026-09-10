import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Hash estable y no reversible. Guardamos esto, nunca la IP ni el correo en claro en `rate_limits`. */
export function hmac(value: string): string {
  return createHmac("sha256", serverEnv.appSecret).update(value).digest("hex");
}

export function hashIp(ip: string): string {
  return hmac(`ip:${ip}`);
}

export function hashEmail(email: string): string {
  return hmac(`email:${normalizeEmail(email)}`);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Token del enlace de verificación: se envía en claro, se guarda hasheado. */
export function createVerifyToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Codigo de verificacion de 6 digitos. Se guarda su HMAC, nunca el codigo. */
export function createVerifyCode(): { code: string; codeHash: string } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return { code, codeHash: hashCode(code) };
}

export function hashCode(code: string): string {
  return hmac(`code:${code.trim()}`);
}
