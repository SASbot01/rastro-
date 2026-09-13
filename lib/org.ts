import { supabaseAdmin } from "@/lib/supabase";
import type { UserRow } from "@/lib/users";

/** v5 — Rastro Equipos. Helpers de organizacion. */
export interface Org { id: string; name: string; owner_user_id: string; seats: number }

export async function orgForOwner(user: Pick<UserRow, "id">): Promise<Org | null> {
  const { data } = await supabaseAdmin().from("orgs").select("id, name, owner_user_id, seats").eq("owner_user_id", user.id).maybeSingle<Org>();
  return data ?? null;
}

export async function orgById(id: string): Promise<Org | null> {
  const { data } = await supabaseAdmin().from("orgs").select("id, name, owner_user_id, seats").eq("id", id).maybeSingle<Org>();
  return data ?? null;
}

export interface OrgMemberRow {
  id: string;
  email: string;
  last_seen_at: string | null;
  monitoring: boolean;
  org_share_at: string | null;
  created_at: string;
}

export async function orgMembers(orgId: string): Promise<OrgMemberRow[]> {
  const { data } = await supabaseAdmin().from("users").select("id, email, last_seen_at, monitoring, org_share_at, created_at").eq("org_id", orgId).eq("org_role", "member").order("created_at").returns<OrgMemberRow[]>();
  return data ?? [];
}

/** Ultimo informe de cada miembro que comparte: puntuacion, contrasenas filtradas y fecha. */
export async function memberSnapshots(memberIds: string[]): Promise<Map<string, { score: number; passwords: number; at: string }>> {
  const out = new Map<string, { score: number; passwords: number; at: string }>();
  if (memberIds.length === 0) return out;
  const { data } = await supabaseAdmin()
    .from("reports")
    .select("score, breakdown, created_at, requests!inner(user_id, status)")
    .in("requests.user_id", memberIds)
    .eq("requests.status", "done")
    .order("created_at", { ascending: false })
    .returns<Array<{ score: number; breakdown: Record<string, number> | null; created_at: string; requests: { user_id: string } | Array<{ user_id: string }> }>>();
  for (const r of data ?? []) {
    const req = Array.isArray(r.requests) ? r.requests[0] : r.requests;
    if (!req || out.has(req.user_id)) continue;
    const pw = r.breakdown?.breachWithPassword ? Math.round(Math.abs(r.breakdown.breachWithPassword) / 15) : 0;
    out.set(req.user_id, { score: r.score, passwords: pw, at: r.created_at });
  }
  return out;
}
