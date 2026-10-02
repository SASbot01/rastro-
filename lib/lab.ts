import { supabaseAdmin } from "@/lib/supabase";
import { isPro } from "@/lib/plan";
import { isAdminEmail } from "@/lib/domain-report";
import type { UserRow } from "@/lib/users";
import { defaultWorkspace, sanitizeWorkspace, type LabWorkspace } from "@/lib/lab-core";

export * from "@/lib/lab-core";

/** Rastro Lab es para cuentas Pro y administradores. */
export function canUseLab(user: UserRow | null): boolean {
  return Boolean(user) && (isPro(user) || isAdminEmail(user!.email));
}

export async function loadWorkspace(userId: string, locale: "es" | "en"): Promise<{ workspace: LabWorkspace; updatedAt: string | null }> {
  const { data } = await supabaseAdmin().from("lab_workspaces").select("data, updated_at").eq("user_id", userId).maybeSingle<{ data: unknown; updated_at: string }>();
  if (!data) return { workspace: defaultWorkspace(locale), updatedAt: null };
  return { workspace: sanitizeWorkspace(data.data, locale) ?? defaultWorkspace(locale), updatedAt: data.updated_at };
}
