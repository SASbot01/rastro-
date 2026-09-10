import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CommunityChat } from "@/components/CommunityChat";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Row { id: number; user_id: string; alias: string; body: string; created_at: string }

/** Comunidad: chat global. Se lee sin sesion; se escribe con cuenta y alias. */
export default async function CommunityPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;

  const { data } = await supabaseAdmin()
    .from("community_messages")
    .select("id, user_id, alias, body, created_at")
    .eq("hidden", false)
    .order("id", { ascending: false })
    .limit(50)
    .returns<Row[]>();
  const initial = (data ?? [])
    .sort((a, b) => a.id - b.id)
    .map((m) => ({ id: m.id, alias: m.alias, body: m.body, created_at: m.created_at, mine: user ? m.user_id === user.id : false }));

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-6 sm:py-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-ink">{tr("community.title")}</h1>
            <p className="mt-1 max-w-[560px] text-[14px] leading-relaxed text-muted">{tr("community.subtitle")}</p>
          </div>
          {user?.alias && <span className="rounded-full bg-surface-2 px-3 py-1 text-[12px] font-semibold text-accent">@{user.alias}</span>}
        </div>
        <CommunityChat initial={initial} canWrite={Boolean(user)} hasAlias={Boolean(user?.alias)} locale={locale} messages={messages} />
        <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">{tr("community.rules")}</p>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
