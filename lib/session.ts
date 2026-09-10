import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { hmac, normalizeEmail, safeEqual } from "@/lib/crypto";

/**
 * Sesion propia por cookie firmada (HMAC con APP_SECRET). Se crea al verificar
 * un enlace magico (de informe o de acceso). Sin base de datos de sesiones:
 * el contenido es solo correo + caducidad, y la firma impide manipularlo.
 */

export const SESSION_COOKIE = "rastro_session";
const SESSION_DAYS = 30;

export interface Session {
  email: string;
  expiresAt: number;
}

function encode(payload: Session): string {
  const body = Buffer.from(JSON.stringify({ e: payload.email, x: payload.expiresAt })).toString("base64url");
  return `${body}.${hmac(`session:${body}`)}`;
}

function decode(value: string | undefined): Session | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(`session:${body}`))) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(body, "base64url").toString()) as { e: string; x: number };
    if (typeof e !== "string" || typeof x !== "number" || x < Date.now()) return null;
    return { email: e, expiresAt: x };
  } catch {
    return null;
  }
}

/** Sesion actual (o null). Solo servidor. */
export async function getSession(): Promise<Session | null> {
  return decode((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Pone la cookie de sesion en una respuesta (route handlers). */
export function setSessionCookie(response: NextResponse, email: string): void {
  const expiresAt = Date.now() + SESSION_DAYS * 86_400_000;
  response.cookies.set(SESSION_COOKIE, encode({ email: normalizeEmail(email), expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

/** true si la sesion pertenece a este correo (comparacion normalizada). */
export function sessionOwns(session: Session | null, email: string): boolean {
  return Boolean(session && session.email === normalizeEmail(email));
}
