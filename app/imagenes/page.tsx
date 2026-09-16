import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { isPro, prices } from "@/lib/plan";
import { searchImages, type ImageHit } from "@/lib/brave";

export const dynamic = "force-dynamic";
const CARD = "rounded-card border border-line bg-surface p-5 sm:p-6";
const BTN = "inline-block rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90";

/** v4 — Imagenes publicas asociadas al nombre, con carta de retirada por sitio. */
export default async function ImagesPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const pro = isPro(user);

  let person: { full_name: string; city: string | null } | null = null;
  let result: { ok: true; hits: ImageHit[] } | { ok: false; reason: string } | null = null;
  if (user && pro) {
    const { data } = await supabaseAdmin().from("requests").select("full_name, city").eq("user_id", user.id).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle<{ full_name: string; city: string | null }>();
    person = data;
    if (person) result = await searchImages({ fullName: person.full_name, city: person.city });
  }
  // Una carta por pagina: agrupar imagenes por pagina de origen.
  const groups = new Map<string, ImageHit[]>();
  if (result?.ok) for (const h of result.hits) groups.set(h.pageUrl, [...(groups.get(h.pageUrl) ?? []), h]);

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-8 sm:py-12">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{tr("images.eyebrow")}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em] text-ink sm:text-[34px]">{tr("images.title")}</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted">{tr("images.subtitle")}</p>

        {!user ? (
          <section className={CARD + " mt-6"}><p className="text-[15px] font-semibold text-ink">{tr("tools.loginTitle")}</p><Link href="/entrar" className={"mt-4 " + BTN}>{tr("nav.login")}</Link></section>
        ) : !pro ? (
          <section className={CARD + " mt-6"}><p className="text-[15px] font-semibold text-ink">{tr("pro.locked")}</p><p className="mt-1 text-[14px] text-muted">{tr("images.proOnly")} {tr("pro.lockedBody", { monthly: prices().monthly, yearly: prices().yearly })}</p><Link href="/pro" className={"mt-4 " + BTN}>{tr("pro.lockedCta")}</Link></section>
        ) : !person ? (
          <section className={CARD + " mt-6"}><p className="text-[15px] font-semibold text-ink">{tr("images.noReport")}</p><Link href="/#form" className={"mt-4 " + BTN}>{tr("account.newReport")}</Link></section>
        ) : !result?.ok ? (
          <section className={CARD + " mt-6"}><p className="text-[14px] text-muted">{tr("images.unavailable")}</p></section>
        ) : result.hits.length === 0 ? (
          <section className={CARD + " mt-6"}><p className="text-[15px] font-semibold text-accent">{tr("images.none")}</p></section>
        ) : (
          <>
            <p className="mt-6 px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("images.count", { n: result.hits.length })} · {person.full_name}{person.city ? ` · ${person.city}` : ""}</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {[...groups.entries()].map(([pageUrl, hits]) => (
                <li key={pageUrl} className="overflow-hidden rounded-card border border-line bg-surface">
                  <div className="grid grid-cols-3 gap-1 bg-surface-2 p-1">
                    {hits.slice(0, 3).map((h, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={h.thumbnail} alt="" className="aspect-square w-full rounded-[8px] object-cover" loading="lazy" />
                    ))}
                  </div>
                  <div className="p-4">
                    <p className="truncate text-[14px] font-semibold text-ink">{hits[0].title || hits[0].hostname}</p>
                    <p className="truncate text-[12px] text-faint">{hits[0].hostname}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <a href={pageUrl} target="_blank" rel="noreferrer nofollow" className="text-[13px] font-medium text-muted underline underline-offset-4 hover:text-ink">{tr("images.source")}</a>
                      <form action="/api/letters" method="post"><input type="hidden" name="page_url" value={pageUrl} /><button type="submit" className="text-[13px] font-medium text-accent underline underline-offset-4">{tr("images.remove")}</button></form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12.5px] leading-relaxed text-faint">{tr("images.removeHint")} <a href="https://support.google.com/websearch/troubleshooter/3111061" target="_blank" rel="noreferrer nofollow" className="text-accent underline underline-offset-4">{tr("images.google")}</a></p>
          </>
        )}
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
