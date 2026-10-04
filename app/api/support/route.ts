import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { sendSupportEmail } from "@/lib/email";
import { getSession } from "@/lib/session";
import { allowRequest } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";
import { LOCALES } from "@/lib/i18n";

/** Formulario de soporte: envia el mensaje al equipo y un acuse al usuario. */
export const runtime = "nodejs";

const schema = z.object({
  email: z.email().trim().toLowerCase(),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(10).max(4000),
  page: z.string().trim().max(200).optional(),
  locale: z.enum(LOCALES).default("es"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "message");
    return NextResponse.json({ ok: false, error: field === "email" ? "formErrors.email" : `support.errors.${field === "subject" ? "subject" : "message"}` }, { status: 400 });
  }
  const { email, subject, message, page, locale } = parsed.data;

  const h = await headers();
  const ip = clientIpFrom(h);
  if (!(await allowRequest(email, ip, "support"))) return NextResponse.json({ ok: false, error: "formErrors.rateLimit" }, { status: 429 });

  // Si hay sesion, el remitente es la cuenta (evita suplantar a otro).
  const session = await getSession();
  const from = session?.email ?? email;

  try {
    await sendSupportEmail({ from, subject, message, locale, page: page ?? null });
    return NextResponse.json({ ok: true, email: from });
  } catch (error) {
    console.error("[soporte] fallo:", error);
    return NextResponse.json({ ok: false, error: "formErrors.generic" }, { status: 500 });
  }
}
