import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

/** El miembro decide si comparte su puntuacion con la empresa (form: share = 1|0). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user || user.org_role !== "member") return NextResponse.redirect(absoluteUrl("/cuenta"), { status: 303 });
  const share = String((await request.formData()).get("share") ?? "") === "1";
  await supabaseAdmin().from("users").update({ org_share_at: share ? new Date().toISOString() : null }).eq("id", user.id);
  return NextResponse.redirect(absoluteUrl("/cuenta"), { status: 303 });
}
