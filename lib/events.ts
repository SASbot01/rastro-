import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Metricas de producto propias (embudo). Privacidad por diseño: solo el nombre
 * del evento, el idioma, propiedades pequeñas sin datos personales y un
 * "subject" que es un hash salado y truncado (sirve para contar unicos, no
 * para saber quien es). Sin IP, sin correo, sin cookies. Nunca lanza: una
 * metrica que falla no puede romper la app.
 */
export const EVENTS = [
  "form_submitted", "email_verified", "report_ready", "report_failed", "report_viewed", "report_shared",
  "signup", "login", "letter_created", "letter_sent", "removal_verified",
  "checkout_started", "pro_activated", "monitoring_on",
  "guardian_used", "simulator_used", "images_used", "mailbox_scanned",
  "ai_change_detected", "site_check_listed", "extension_page_viewed", "extension_download", "nurture_sent",
  "domain_report_requested", "domain_report_generated", "domain_report_viewed",
] as const;
export type EventName = (typeof EVENTS)[number];

/** Orden del embudo principal (para la pagina de metricas). */
export const FUNNEL: EventName[] = ["form_submitted", "email_verified", "report_ready", "report_viewed", "signup", "checkout_started", "pro_activated"];

export function hashSubject(id: string): string {
  return createHash("sha256").update(`${process.env.APP_SECRET ?? "rastro"}:evt:${id}`).digest("hex").slice(0, 16);
}

type Props = Record<string, string | number | boolean | null>;

export async function track(name: EventName, opts: { subject?: string | null; locale?: string | null; props?: Props } = {}): Promise<void> {
  try {
    if (process.env.PRODUCT_EVENTS_DISABLED === "1") return;
    const { error } = await supabaseAdmin().from("product_events").insert({
      name,
      subject: opts.subject ? hashSubject(opts.subject) : null,
      locale: opts.locale ?? null,
      props: opts.props ?? {},
    });
    if (error) console.warn("[events]", name, error.message);
  } catch (e) {
    console.warn("[events]", name, String(e).slice(0, 120));
  }
}
