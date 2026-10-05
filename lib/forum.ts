import { supabaseAdmin } from "@/lib/supabase";
import { FORUM_TAGS } from "@/lib/forum-core";

/** Comunidad / foro — acceso a datos. Solo el servidor (service_role). */

const THREAD_COLS = "id, author_name, official, tag, title, body, pinned, reply_count, last_activity_at, created_at";

export interface ThreadRow {
  id: string;
  author_name: string | null;
  official: boolean;
  tag: string;
  title: string;
  body: string;
  pinned: boolean;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
}
export interface ReplyRow { id: string; author_name: string | null; official: boolean; body: string; created_at: string }

export async function listThreads(opts: { tag?: string; limit?: number } = {}): Promise<ThreadRow[]> {
  let q = supabaseAdmin()
    .from("forum_threads")
    .select(THREAD_COLS)
    .eq("hidden", false)
    .order("pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .limit(opts.limit ?? 60);
  if (opts.tag && (FORUM_TAGS as readonly string[]).includes(opts.tag)) q = q.eq("tag", opts.tag);
  const { data } = await q.returns<ThreadRow[]>();
  return data ?? [];
}

export async function getThread(id: string): Promise<{ thread: ThreadRow; replies: ReplyRow[] } | null> {
  const { data: thread } = await supabaseAdmin().from("forum_threads").select(THREAD_COLS).eq("id", id).eq("hidden", false).maybeSingle<ThreadRow>();
  if (!thread) return null;
  const { data: replies } = await supabaseAdmin()
    .from("forum_replies")
    .select("id, author_name, official, body, created_at")
    .eq("thread_id", id)
    .eq("hidden", false)
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<ReplyRow[]>();
  return { thread, replies: replies ?? [] };
}

export async function createThread(input: { authorId: string; authorName: string; tag: string; title: string; body: string; ipHash: string }): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("forum_threads")
    .insert({ author_id: input.authorId, author_name: input.authorName, tag: input.tag, title: input.title, body: input.body, ip_hash: input.ipHash, last_activity_at: new Date().toISOString() })
    .select("id")
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export async function createReply(input: { threadId: string; authorId: string; authorName: string; body: string; ipHash: string }): Promise<boolean> {
  const sb = supabaseAdmin();
  const { error } = await sb.from("forum_replies").insert({ thread_id: input.threadId, author_id: input.authorId, author_name: input.authorName, body: input.body, ip_hash: input.ipHash });
  if (error) {
    console.error("[forum] reply fallo:", error.message);
    return false;
  }
  // Suma la respuesta y actualiza la actividad en una sola sentencia atómica.
  await sb.rpc("bump_forum_thread", { p_id: input.threadId }).then(() => undefined, (e) => console.error("[forum] bump fallo:", e));
  return true;
}

export async function reportTarget(input: { type: "thread" | "reply"; id: string; reporterId: string; reason: string }): Promise<void> {
  await supabaseAdmin().from("forum_reports").insert({ target_type: input.type, target_id: input.id, reporter_id: input.reporterId, reason: input.reason.slice(0, 500) });
}

/** Moderación (solo admin): oculta/muestra un tema o respuesta. */
export async function setHidden(type: "thread" | "reply", id: string, hidden: boolean): Promise<void> {
  await supabaseAdmin().from(type === "thread" ? "forum_threads" : "forum_replies").update({ hidden }).eq("id", id);
}
