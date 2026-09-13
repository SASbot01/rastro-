import { NextResponse } from "next/server";
import { z } from "zod";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { ensureUser, findUserByEmail } from "@/lib/users";
import { FAMILY_SEATS, isPro } from "@/lib/plan";
import { sendNoticeEmail } from "@/lib/email";
import { createLoginLink } from "@/lib/login-link";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { normalizeEmail } from "@/lib/crypto";

/**
 * Plan familiar: el titular anade o quita personas (formulario POST desde
 * /cuenta, campos `action` = add | remove y `email`). El miembro recibe Pro
 * con la misma fecha de fin que el titular y un correo con enlace de acceso.
 */
export const runtime = "nodejs";

const schema = z.object({ action: z.enum(["add", "remove"]), email: z.email().trim().toLowerCase() });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const owner = await findUserByEmail(session.email);
  if (!owner) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const back = (code: string) => NextResponse.redirect(absoluteUrl(`/cuenta?familia=${code}`), { status: 303 });

  const form = await request.formData();
  const parsed = schema.safeParse({ action: String(form.get("action") ?? ""), email: String(form.get("email") ?? "") });
  if (!parsed.success) return back("invalid");
  const { action, email } = parsed.data;
  if (!isPro(owner) || owner.plan_kind !== "family") return back("notOwner");
  if (normalizeEmail(email) === owner.email) return back("self");

  const supabase = supabaseAdmin();
  const { data: members } = await supabase.from("users").select("id, email").eq("family_owner_id", owner.id).eq("plan_kind", "member").returns<{ id: string; email: string }[]>();
  const list = members ?? [];

  if (action === "remove") {
    const m = list.find((x) => x.email === normalizeEmail(email));
    if (m) await supabase.from("users").update({ plan: "free", plan_until: null, plan_status: null, plan_kind: "individual", family_owner_id: null }).eq("id", m.id);
    return back("removed");
  }

  if (list.length >= FAMILY_SEATS - 1) return back("full");
  const locale: Locale = isLocale(owner.locale) ? owner.locale : "es";
  const member = await ensureUser(email, locale);
  if (!member) return back("invalid");
  // Quien ya paga su propio Pro no entra en la familia (no se pisa una suscripcion real).
  if (isPro(member) && member.plan_kind === "individual" && member.stripe_customer_id) return back("exists");
  if (member.family_owner_id && member.family_owner_id !== owner.id) return back("exists");

  const { error } = await supabase
    .from("users")
    .update({ plan: "pro", plan_until: owner.plan_until, plan_status: owner.plan_status, plan_kind: "member", family_owner_id: owner.id })
    .eq("id", member.id);
  if (error) {
    console.error("[/api/family] update fallo:", error.message);
    return back("invalid");
  }

  try {
    const tr = translator(getMessages(locale));
    const ownerName = owner.email;
    const link = await createLoginLink(member.email, locale, "/");
    await sendNoticeEmail({
      to: member.email,
      subject: tr("family.inviteEmail.subject", { owner: ownerName }),
      greeting: tr("family.inviteEmail.greeting"),
      paragraphs: [tr("family.inviteEmail.body", { owner: ownerName }), tr("family.inviteEmail.ask")],
      cta: tr("family.inviteEmail.cta"),
      url: link,
      footer: tr("family.inviteEmail.footer"),
    });
  } catch (e) {
    console.error("[/api/family] correo fallo:", e);
  }
  return back("added");
}
