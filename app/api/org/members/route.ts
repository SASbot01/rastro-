import { NextResponse } from "next/server";
import { z } from "zod";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { ensureUser, findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";
import { orgForOwner, orgMembers } from "@/lib/org";
import { sendNoticeEmail } from "@/lib/email";
import { createLoginLink } from "@/lib/login-link";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { normalizeEmail } from "@/lib/crypto";

/** Rastro Equipos: el titular invita (add) o quita (remove) personas. POST form: action, email. */
export const runtime = "nodejs";
const schema = z.object({ action: z.enum(["add", "remove"]), email: z.email().trim().toLowerCase() });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const owner = await findUserByEmail(session.email);
  const back = (code: string) => NextResponse.redirect(absoluteUrl(`/equipo?e=${code}`), { status: 303 });
  if (!owner || owner.plan_kind !== "team" || !isPro(owner)) return back("notOwner");
  const org = await orgForOwner(owner);
  if (!org) return back("notOwner");
  const form = await request.formData();
  const parsed = schema.safeParse({ action: String(form.get("action") ?? ""), email: String(form.get("email") ?? "") });
  if (!parsed.success) return back("invalid");
  const { action, email } = parsed.data;
  if (normalizeEmail(email) === owner.email) return back("invalid");

  const supabase = supabaseAdmin();
  const members = await orgMembers(org.id);
  if (action === "remove") {
    const m = members.find((x) => x.email === normalizeEmail(email));
    if (m) await supabase.from("users").update({ plan: "free", plan_until: null, plan_status: null, plan_kind: "individual", org_id: null, org_role: null, org_share_at: null }).eq("id", m.id);
    return NextResponse.redirect(absoluteUrl("/equipo?ok=removed"), { status: 303 });
  }
  if (members.length >= org.seats - 1) return back("full");
  const locale: Locale = isLocale(owner.locale) ? owner.locale : "es";
  const member = await ensureUser(email, locale);
  if (!member) return back("invalid");
  if ((isPro(member) && member.stripe_customer_id) || (member.org_id && member.org_id !== org.id) || member.family_owner_id) return back("exists");
  const { error } = await supabase.from("users").update({ plan: "pro", plan_until: owner.plan_until, plan_status: owner.plan_status, plan_kind: "member", org_id: org.id, org_role: "member" }).eq("id", member.id);
  if (error) return back("invalid");
  try {
    const tr = translator(getMessages(locale));
    const link = await createLoginLink(member.email, locale, "/");
    await sendNoticeEmail({ to: member.email, subject: tr("team.inviteEmail.subject", { org: org.name }), greeting: tr("team.inviteEmail.greeting"), paragraphs: [tr("team.inviteEmail.body", { org: org.name }), tr("team.inviteEmail.ask")], cta: tr("team.inviteEmail.cta"), url: link, footer: tr("team.inviteEmail.footer") });
  } catch (e) {
    console.error("[/api/org/members] correo fallo:", e);
  }
  return NextResponse.redirect(absoluteUrl("/equipo?ok=added"), { status: 303 });
}
