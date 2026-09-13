import { NextResponse } from "next/server";
import { z } from "zod";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { orgForOwner } from "@/lib/org";
import { TEAM_SEATS } from "@/lib/plan";

/** Crea (si el titular tiene plan 'team' y aun no la tiene) o renombra la organizacion. POST form: name. */
export const runtime = "nodejs";
const schema = z.object({ name: z.string().trim().min(2).max(80) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user || user.plan_kind !== "team") return NextResponse.redirect(absoluteUrl("/equipo?e=notOwner"), { status: 303 });
  const parsed = schema.safeParse({ name: String((await request.formData()).get("name") ?? "") });
  if (!parsed.success) return NextResponse.redirect(absoluteUrl("/equipo?e=invalid"), { status: 303 });
  const supabase = supabaseAdmin();
  const org = await orgForOwner(user);
  if (org) await supabase.from("orgs").update({ name: parsed.data.name }).eq("id", org.id);
  else {
    const { data: created } = await supabase.from("orgs").insert({ name: parsed.data.name, owner_user_id: user.id, seats: TEAM_SEATS }).select("id").single<{ id: string }>();
    if (created) await supabase.from("users").update({ org_id: created.id, org_role: "owner" }).eq("id", user.id);
  }
  return NextResponse.redirect(absoluteUrl("/equipo"), { status: 303 });
}
