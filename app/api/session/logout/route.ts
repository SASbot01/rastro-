import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

/** Cierra la sesion (POST desde el formulario de /cuenta) y vuelve al inicio. */
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/", new URL(request.url).origin), { status: 303 });
  clearSessionCookie(res);
  return res;
}
