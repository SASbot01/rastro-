import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { absoluteUrl } from "@/lib/env";
import { STATE_COOKIE, exchangeCodeLogin, googleUserInfo, verifyState } from "@/lib/google";
import { ensureUser } from "@/lib/users";
import { setSessionCookie } from "@/lib/session";
import { getLocale } from "@/lib/locale";

/**
 * Vuelta de "Continuar con Google": valida el estado, obtiene el correo
 * verificado de Google, crea la cuenta si no existe y abre sesion.
 * Sin contrasenas, sin acceso al buzon.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (e: string) => NextResponse.redirect(absoluteUrl(`/entrar?e=${e}`));
  if (url.searchParams.get("error")) return fail("denied");

  const code = url.searchParams.get("code");
  const cookieState = (await cookies()).get(STATE_COOKIE)?.value;
  if (!code || !verifyState(url.searchParams.get("state"), cookieState, "login")) return fail("state");

  let email: string;
  try {
    const t = await exchangeCodeLogin(code);
    const info = await googleUserInfo(t.accessToken);
    if (!info.email || !info.emailVerified) return fail("google");
    email = info.email;
  } catch (error) {
    console.error("[google login] fallo:", error);
    return fail("google");
  }

  const user = await ensureUser(email, await getLocale());
  if (!user) return fail("db");

  const next = url.searchParams.get("next") ?? "";
  const dest = /^\/(?!\/)[\w\-/?=&.]*$/.test(next) ? next : "/cuenta";
  const res = NextResponse.redirect(absoluteUrl(dest));
  setSessionCookie(res, email);
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
