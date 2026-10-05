import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { absoluteUrl } from "@/lib/env";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { clientIpFrom } from "@/lib/client-ip";
import { hashIp } from "@/lib/crypto";
import { allowRequest } from "@/lib/rate-limit";
import { validateThread, validateReply, displayName } from "@/lib/forum-core";
import { createThread, createReply, reportTarget } from "@/lib/forum";
import { track } from "@/lib/events";

/**
 * Publicar en la comunidad (cuenta con sesión). Formulario POST + redirect.
 * action: thread | reply | report. Texto validado/saneado en lib/forum-core.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar?next=/comunidad"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const h = await headers();
  const ip = clientIpFrom(h);
  const ipHash = hashIp(ip);

  if (action === "thread") {
    const v = validateThread({ title: form.get("title"), body: form.get("body"), tag: form.get("tag") });
    if (!v.ok) return NextResponse.redirect(absoluteUrl(`/comunidad?e=${v.error}`), { status: 303 });
    if (!(await allowRequest(session.email, ip, "forum_thread"))) return NextResponse.redirect(absoluteUrl("/comunidad?e=rate"), { status: 303 });
    const id = await createThread({ authorId: user.id, authorName: displayName(user), tag: v.tag, title: v.title, body: v.body, ipHash });
    void track("forum_thread_created", { subject: user.id });
    return NextResponse.redirect(absoluteUrl(id ? `/comunidad/${id}` : "/comunidad?e=server"), { status: 303 });
  }

  if (action === "reply") {
    const threadId = String(form.get("thread_id") ?? "");
    if (!threadId) return NextResponse.redirect(absoluteUrl("/comunidad"), { status: 303 });
    const v = validateReply({ body: form.get("body") });
    if (!v.ok) return NextResponse.redirect(absoluteUrl(`/comunidad/${threadId}?e=${v.error}`), { status: 303 });
    if (!(await allowRequest(session.email, ip, "forum_reply"))) return NextResponse.redirect(absoluteUrl(`/comunidad/${threadId}?e=rate`), { status: 303 });
    await createReply({ threadId, authorId: user.id, authorName: displayName(user), body: v.body, ipHash });
    void track("forum_reply_created", { subject: user.id });
    return NextResponse.redirect(absoluteUrl(`/comunidad/${threadId}?e=posted#final`), { status: 303 });
  }

  if (action === "report") {
    const type = form.get("type") === "reply" ? "reply" : "thread";
    const id = String(form.get("id") ?? "");
    const back = String(form.get("back") ?? "/comunidad");
    if (id) await reportTarget({ type, id, reporterId: user.id, reason: String(form.get("reason") ?? "") });
    return NextResponse.redirect(absoluteUrl(`${back}?e=reported`), { status: 303 });
  }

  return NextResponse.redirect(absoluteUrl("/comunidad"), { status: 303 });
}
