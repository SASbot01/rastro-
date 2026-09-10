import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { normalizeEmail } from "@/lib/crypto";

/** Perfil editable: nombre para mostrar y foto (data URL JPEG/PNG/WebP pequena). */
export const runtime = "nodejs";

const AVATAR_MAX = 160_000; // ~120 KB de imagen en base64
const schema = z.object({
  name: z.string().trim().min(2).max(60),
  avatar: z
    .string()
    .max(AVATAR_MAX)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .nullable()
    .optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "account.mustLoginTitle" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "name");
    return NextResponse.json({ ok: false, error: field === "avatar" ? "profile2.errPhoto" : "profile2.errName" }, { status: 400 });
  }
  const { name, avatar } = parsed.data;
  const patch: Record<string, unknown> = { display_name: name };
  if (avatar !== undefined) patch.avatar = avatar; // null = quitar foto; ausente = no tocar

  const { error } = await supabaseAdmin().from("users").update(patch).eq("email", normalizeEmail(session.email));
  if (error) {
    console.error("[/api/profile] fallo:", error.message);
    return NextResponse.json({ ok: false, error: "formErrors.generic" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
