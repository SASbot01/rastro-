import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { clearSessionCookie } from "@/lib/session";

/** Cierra la sesion (POST desde el formulario de /cuenta) y vuelve al inicio. */
export async function POST(request: Request) {
  const res = NextResponse.redirect(absoluteUrl("/"), { status: 303 });
  clearSessionCookie(res);
  return res;
}
