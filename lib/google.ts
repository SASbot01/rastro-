import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { hmac, safeEqual } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";

/**
 * OAuth de Google para el escaner de buzon. Sin libreria: tres endpoints.
 * Permiso: gmail.readonly (solo se piden cabeceras; nunca cuerpos).
 * Los tokens no se guardan: viven en memoria durante el escaneo y se revocan.
 */

export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"];
export const STATE_COOKIE = "rastro_gstate";

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error("Falta GOOGLE_CLIENT_ID");
  return v;
}
function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error("Falta GOOGLE_CLIENT_SECRET");
  return v;
}
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
export function redirectUri(): string {
  return `${serverEnv.siteUrl}/api/google/callback`;
}

/** Estado anti-CSRF: nonce firmado, ligado al correo de la sesion. */
export function createState(email: string): string {
  const nonce = randomBytes(16).toString("base64url");
  return `${nonce}.${hmac(`gstate:${email}:${nonce}`)}`;
}
export function verifyState(state: string | null, cookieState: string | undefined, email: string): boolean {
  if (!state || !cookieState || !safeEqual(state, cookieState)) return false;
  const [nonce, sig] = state.split(".");
  return Boolean(nonce && sig && safeEqual(sig, hmac(`gstate:${email}:${nonce}`)));
}
export function setStateCookie(res: NextResponse, state: string): void {
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "online",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; scope: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; scope?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(`token: ${data.error ?? res.status} ${data.error_description ?? ""}`);
  return { accessToken: data.access_token, scope: data.scope ?? "" };
}

/** Correo del buzon conectado (puede no coincidir con el de la cuenta de Rastro). */
export async function mailboxAddress(accessToken: string): Promise<string> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { emailAddress?: string };
  if (!res.ok || !data.emailAddress) throw new Error(`profile: HTTP ${res.status}`);
  return data.emailAddress.toLowerCase();
}

/** Revoca el token al terminar: Rastro deja de tener acceso sin que el usuario haga nada. */
export async function revokeToken(accessToken: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

/* ---------- "Continuar con Google": solo identidad (openid + email) ---------- */
export const GOOGLE_LOGIN_SCOPES = ["openid", "email"];
export function redirectUriLogin(): string {
  return `${serverEnv.siteUrl}/api/auth/google/callback`;
}
export function authUrlLogin(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUriLogin(),
    response_type: "code",
    scope: GOOGLE_LOGIN_SCOPES.join(" "),
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
export async function exchangeCodeLogin(code: string): Promise<{ accessToken: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId(), client_secret: clientSecret(), redirect_uri: redirectUriLogin(), grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(`token: ${data.error ?? res.status} ${data.error_description ?? ""}`);
  return { accessToken: data.access_token };
}
export async function googleUserInfo(accessToken: string): Promise<{ email: string | null; emailVerified: boolean }> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { email?: string; email_verified?: boolean };
  return { email: data.email?.toLowerCase() ?? null, emailVerified: Boolean(data.email_verified) };
}
