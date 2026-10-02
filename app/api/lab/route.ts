import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { canUseLab, importLegacy, isLegacy, loadWorkspace, sanitizeWorkspace, LIMITS } from "@/lib/lab";
import { isLocale } from "@/lib/i18n";
import { track } from "@/lib/events";

/**
 * Rastro Lab: guarda y lee el cuaderno de la cuenta. Privado: solo la propia
 * cuenta, nunca sale por la API publica. Todo lo que llega se limpia y se
 * acota (lib/lab-core) antes de guardarse. `base` evita pisar cambios hechos
 * desde otro dispositivo: si el servidor tiene una version mas nueva, 409.
 */
export const runtime = "nodejs";

async function owner() {
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  return canUseLab(user) ? user! : null;
}

export async function GET() {
  const user = await owner();
  if (!user) return NextResponse.json({ ok: false }, { status: 403 });
  const locale = isLocale(user.locale) ? user.locale : "es";
  const { workspace, updatedAt } = await loadWorkspace(user.id, locale);
  return NextResponse.json({ ok: true, workspace, updatedAt }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await owner();
  if (!user) return NextResponse.json({ ok: false }, { status: 403 });
  const raw = await request.text();
  if (raw.length > LIMITS.bytes * 2) return NextResponse.json({ ok: false, error: "lab.errors.tooBig" }, { status: 413 });
  let body: { workspace?: unknown; base?: string | null; import?: boolean };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const locale = isLocale(user.locale) ? user.locale : "es";
  const clean = body.import && isLegacy(body.workspace) ? importLegacy(body.workspace, locale) : sanitizeWorkspace(body.workspace, locale);
  if (!clean) return NextResponse.json({ ok: false, error: "lab.errors.tooBig" }, { status: 413 });

  const supabase = supabaseAdmin();
  const { data: current } = await supabase.from("lab_workspaces").select("updated_at").eq("user_id", user.id).maybeSingle<{ updated_at: string }>();
  if (current && !body.import && body.base !== current.updated_at) return NextResponse.json({ ok: false, error: "lab.errors.conflict" }, { status: 409 });
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from("lab_workspaces").upsert({ user_id: user.id, data: clean, updated_at: updatedAt }, { onConflict: "user_id" });
  if (error) {
    console.error("[/api/lab] guardado fallo:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (!current) void track("lab_started", { subject: user.id, locale });
  return NextResponse.json({ ok: true, updatedAt, workspace: body.import ? clean : undefined });
}

/** sendBeacon (al cerrar la pestana con cambios sin guardar) solo sabe hacer POST: mismo tratamiento que PUT. */
export const POST = PUT;
