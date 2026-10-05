import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { absoluteUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSupportEmail } from "@/lib/email";
import { allowRequest } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";
import { hashIp } from "@/lib/crypto";
import { getLocale } from "@/lib/locale";
import { track } from "@/lib/events";

/**
 * Solicitud de acceso para empresas (Rastro Equipos). Formulario POST + redirect.
 * Guarda la solicitud y avisa al equipo (y manda acuse a quien la envía) con
 * sendSupportEmail. No crea cuenta: Rastro la revisa y da de alta a la empresa.
 */
const S = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const form = await request.formData();
  const name = S(form.get("name"), 120);
  const company = S(form.get("company"), 120);
  const role = S(form.get("role"), 120);
  const phone = S(form.get("phone"), 40);
  const email = S(form.get("email"), 160).toLowerCase();
  const seats = S(form.get("seats"), 40);
  const message = S(form.get("message"), 2000);

  const back = "/empresas/acceso";
  if (name.length < 2 || company.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.redirect(absoluteUrl(`${back}?e=invalid`), { status: 303 });
  }

  const h = await headers();
  const ip = clientIpFrom(h);
  if (!(await allowRequest(email, ip, "support"))) return NextResponse.redirect(absoluteUrl(`${back}?e=rate`), { status: 303 });

  const locale = await getLocale();
  await supabaseAdmin().from("team_requests").insert({ name, company, role: role || null, phone: phone || null, email, seats: seats || null, message: message || null, ip_hash: hashIp(ip) });
  void track("team_request", {});

  const detail = [
    `Empresa: ${company}`,
    `Contacto: ${name}`,
    role && `Cargo: ${role}`,
    phone && `Teléfono: ${phone}`,
    `Correo: ${email}`,
    seats && `Nº personas: ${seats}`,
    message && `\nMensaje:\n${message}`,
  ].filter(Boolean).join("\n");

  try {
    await sendSupportEmail({ from: email, subject: `Solicitud Equipos: ${company}`, message: detail, locale, page: "/empresas/acceso" });
  } catch (error) {
    console.error("[team-request] correo falló:", error);
    // La solicitud ya está guardada; no perdemos el lead aunque falle el correo.
  }
  return NextResponse.redirect(absoluteUrl(`${back}?ok=1`), { status: 303 });
}
