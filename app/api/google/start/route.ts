import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";
import { authUrl, createState, googleConfigured, setStateCookie } from "@/lib/google";

/** Inicia la conexion con Gmail (Pro). POST desde /cuenta. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  if (!isPro(user)) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });
  if (!googleConfigured()) return NextResponse.redirect(absoluteUrl("/cuenta/buzon?e=config"), { status: 303 });

  const state = createState(session.email);
  const res = NextResponse.redirect(authUrl(state), { status: 303 });
  setStateCookie(res, state);
  return res;
}
