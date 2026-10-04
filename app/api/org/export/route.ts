import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { memberSnapshots, orgForOwner, orgMembers } from "@/lib/org";
import { sharedMonitoring, csvCell } from "@/lib/team-privacy";

/** CSV del panel de equipo (solo lo que cada miembro comparte). */
export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const owner = await findUserByEmail(session.email);
  const org = owner && owner.plan_kind === "team" ? await orgForOwner(owner) : null;
  if (!org) return new NextResponse(null, { status: 403 });
  const members = await orgMembers(org.id);
  const snaps = await memberSnapshots(members.filter((m) => m.org_share_at).map((m) => m.id));
  const rows = [["email", "estado", "comparte", "puntuacion", "contrasenas_filtradas", "vigilancia", "ultimo_informe"]];
  for (const m of members) {
    const s = m.org_share_at ? snaps.get(m.id) : undefined;
    rows.push([m.email, m.last_seen_at ? "activo" : "invitado", m.org_share_at ? "si" : "no", s ? String(s.score) : "", s ? String(s.passwords) : "", sharedMonitoring(m) === null ? "" : sharedMonitoring(m) ? "si" : "no", s ? s.at.slice(0, 10) : ""]);
  }
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  return new NextResponse("﻿" + csv, { headers: { "cache-control": "private, no-store", "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rastro-equipo-${org.id.slice(0, 8)}.csv"` } });
}
