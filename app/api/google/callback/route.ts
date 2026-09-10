import { NextResponse } from "next/server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { absoluteUrl } from "@/lib/env";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";
import { supabaseAdmin } from "@/lib/supabase";
import { STATE_COOKIE, exchangeCode, mailboxAddress, revokeToken, verifyState } from "@/lib/google";
import { runMailboxScan } from "@/lib/mailbox/scan";

/**
 * Vuelta de Google: valida el estado, cambia el codigo por un token de
 * acceso (en memoria), crea el registro del escaneo, lanza el escaneo en
 * `after()` y lleva a la pagina de progreso. El token se revoca al acabar.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (e: string) => NextResponse.redirect(absoluteUrl(`/cuenta/buzon?e=${e}`));

  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"));
  const user = await findUserByEmail(session.email);
  if (!user || !isPro(user)) return NextResponse.redirect(absoluteUrl("/pro"));

  if (url.searchParams.get("error")) return fail("denied");
  const code = url.searchParams.get("code");
  const cookieState = (await cookies()).get(STATE_COOKIE)?.value;
  if (!code || !verifyState(url.searchParams.get("state"), cookieState, session.email)) return fail("state");

  let accessToken: string;
  let mailbox: string;
  try {
    const t = await exchangeCode(code);
    if (!t.scope.includes("gmail.readonly")) {
      await revokeToken(t.accessToken);
      return fail("scope");
    }
    accessToken = t.accessToken;
    mailbox = await mailboxAddress(accessToken);
  } catch (error) {
    console.error("[google] callback fallo:", error);
    return fail("google");
  }

  const { data: scan, error } = await supabaseAdmin()
    .from("mailbox_scans")
    .insert({ user_id: user.id, provider: "google", mailbox })
    .select("id")
    .single<{ id: string }>();
  if (error || !scan) {
    await revokeToken(accessToken);
    return fail("db");
  }

  const scanId = scan.id;
  after(() => runMailboxScan(scanId, accessToken));

  const res = NextResponse.redirect(absoluteUrl(`/cuenta/buzon?scan=${scanId}`));
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
