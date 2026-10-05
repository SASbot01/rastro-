import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runReportJob } from "@/lib/report/job";
import { ensureUser } from "@/lib/users";
import type { Locale } from "@/lib/i18n";

import { track } from "@/lib/events";
/**
 * Completar una verificacion de correo, venga por enlace (/verify) o por
 * codigo (/api/verify-code): crea/actualiza la cuenta, reclama la
 * solicitud de forma atomica (pending -> processing), anula enlace y
 * codigo, y lanza el job del informe tras responder.
 */
export interface VerifiableRow {
  id: string;
  email: string;
  status: string;
  verified_at: string | null;
}

export type ClaimResult =
  | { ok: true; id: string; userId: string | null; alreadyVerified: boolean }
  | { ok: false };

export async function claimAndStart(row: VerifiableRow, locale: Locale): Promise<ClaimResult> {
  const user = await ensureUser(row.email, locale);

  // Ya verificada: no hay nada que arrancar; solo devolver la sesion.
  if (row.verified_at) return { ok: true, id: row.id, userId: user?.id ?? null, alreadyVerified: true };

  const now = new Date().toISOString();
  const { data: claimed, error } = await supabaseAdmin()
    .from("requests")
    .update({
      verified_at: now,
      status: "processing",
      started_at: now,
      verify_token: null,
      verify_expires_at: null,
      verify_code_hash: null,
      user_id: user?.id ?? null,
    })
    .eq("id", row.id)
    .eq("status", "pending") // solo una verificacion arranca el job
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) console.error("[verify] reclamacion fallo:", error.message);
  if (!claimed) return { ok: false };

  const id = row.id;
  void track("email_verified", { subject: id, locale });
  after(() => runReportJob(id));
  return { ok: true, id, userId: user?.id ?? null, alreadyVerified: false };
}
