import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { getSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/domain-report";
import { setHidden } from "@/lib/forum";

/** Moderación de la comunidad: ocultar/mostrar un tema o respuesta. Solo admin. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isAdminEmail(session.email)) return NextResponse.redirect(absoluteUrl("/comunidad"), { status: 303 });
  const form = await request.formData();
  const type = form.get("type") === "reply" ? "reply" : "thread";
  const id = String(form.get("id") ?? "");
  const hidden = form.get("hidden") !== "0";
  const back = String(form.get("back") ?? "/comunidad");
  if (id) await setHidden(type, id, hidden);
  return NextResponse.redirect(absoluteUrl(back), { status: 303 });
}
