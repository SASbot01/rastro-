import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { canUseLab } from "@/lib/lab";
import { exploitSearchLinks, lookupCve, normCve } from "@/lib/cve-lookup";

/** Buscador de CVE/exploit para la web del Lab (sesión). Mismos datos públicos que /api/v1/cve. */
export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(request: Request) {
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  if (!canUseLab(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { cve?: string; q?: string };
  if (body.cve && normCve(body.cve)) return NextResponse.json((await lookupCve(body.cve)) ?? { error: "not_found" });
  if (body.q) return NextResponse.json(exploitSearchLinks(String(body.q)));
  return NextResponse.json({ error: "invalid" }, { status: 400 });
}
