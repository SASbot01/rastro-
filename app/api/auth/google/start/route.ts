import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { authUrlLogin, createState, googleConfigured, setStateCookie } from "@/lib/google";

/**
 * "Continuar con Google": inicio de sesion / registro con la cuenta de
 * Google (solo identidad: openid + email). No pide acceso al buzon.
 * El estado se liga a un nonce en cookie (no hay sesion todavia).
 */
export async function POST() {
  if (!googleConfigured()) return NextResponse.redirect(absoluteUrl("/entrar?e=config"), { status: 303 });
  const state = createState("login");
  const res = NextResponse.redirect(authUrlLogin(state), { status: 303 });
  setStateCookie(res, state);
  return res;
}
