import { supabaseAdmin } from "@/lib/supabase";
import { actionableHosts, computeRemovalStats, type RemovalLetter, type RemovalStats } from "@/lib/removal-stats";

export * from "@/lib/removal-stats";

interface FindingLike { category?: string; source_url?: string | null }

/** Contador de retiradas de una cuenta: cartas (sin las de IA) + sitios del ultimo informe. */
export async function removalStats(userId: string): Promise<RemovalStats> {
  const supabase = supabaseAdmin();
  const [{ data: letters }, { data: report }] = await Promise.all([
    supabase.from("letters").select("id, host, status, kind, outcome, still_listed, removed_at, deadline_at").eq("user_id", userId).neq("kind", "ai").returns<RemovalLetter[]>(),
    supabase.from("reports").select("findings, site_checks, requests!inner(user_id)").eq("requests.user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle<{ findings: FindingLike[] | null; site_checks: Array<{ host: string; status: string }> | null }>(),
  ]);
  const listedSites = (report?.site_checks ?? []).filter((s) => s.status === "listed").map((s) => s.host);
  return computeRemovalStats(letters ?? [], [...actionableHosts(report?.findings), ...listedSites]);
}

