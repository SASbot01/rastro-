import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { levelFor } from "@/lib/report/score";
import { FAMILY_SEATS, isPro, prices } from "@/lib/plan";
import { VigilCalendar } from "@/components/VigilCalendar";
import { ProfileEditor } from "@/components/ProfileEditor";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  full_name: string;
  city: string | null;
  status: string;
  created_at: string;
  reports: { score: number } | { score: number }[] | null;
}

const LEVEL_TEXT = { green: "text-ok", orange: "text-warn", red: "text-danger" } as const;
const CARD = "rounded-card border border-line bg-surface p-5 sm:p-6";

function scoreOf(row: Row): number | null {
  const r = Array.isArray(row.reports) ? row.reports[0] : row.reports;
  return r ? r.score : null;
}

/**
 * Perfil: quien eres, tu plan y tus informes. Lo que Rastro hace por ti
 * (vigilancia, escaner, cartas, plazos) vive en /herramientas.
 */
export default async function AccountPage({ searchParams }: PageProps<"/cuenta">) {
  const { pago, vigilancia, familia } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/entrar");
  const user = await findUserByEmail(session.email);
  if (!user) redirect("/entrar");

  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const pro = isPro(user);

  const supabase = supabaseAdmin();
  const [{ data: rows }, { count: lettersCount }, { data: checkRows }, { data: dailyRows }] = await Promise.all([
    supabase.from("requests").select("id, full_name, city, status, created_at, reports(score)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50).returns<Row[]>(),
    supabase.from("letters").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    // Comprobaciones mensuales hechas (solicitudes creadas por el cron de vigilancia).
    supabase.from("requests").select("created_at").eq("user_id", user.id).eq("origin", "monitor").order("created_at", { ascending: false }).limit(24).returns<{ created_at: string }[]>(),
    // Comprobaciones diarias de las ultimas dos semanas (tira semanal + racha).
    supabase.from("daily_checks").select("day, status").eq("user_id", user.id).order("day", { ascending: false }).limit(14).returns<{ day: string; status: "ok" | "alert" | "error" }[]>(),
  ]);
  const checks = (checkRows ?? []).map((r) => r.created_at);
  // Plan familiar: miembros del titular, o titular del miembro.
  const { data: familyMembers } = user.plan_kind === "family"
    ? await supabase.from("users").select("id, email, last_seen_at").eq("family_owner_id", user.id).eq("plan_kind", "member").order("created_at").returns<{ id: string; email: string; last_seen_at: string | null }[]>()
    : { data: null };
  const { data: orgRow } = user.org_id ? await supabase.from("orgs").select("name").eq("id", user.org_id).maybeSingle<{ name: string }>() : { data: null };
  const orgName = orgRow?.name ?? null;
  const { data: familyOwner } = user.plan_kind === "member" && user.family_owner_id
    ? await supabase.from("users").select("email").eq("id", user.family_owner_id).maybeSingle<{ email: string }>()
    : { data: null };
  const list = rows ?? [];
  const lastScore = list.map(scoreOf).find((v) => v !== null) ?? null;
  const name = user.display_name ?? list[0]?.full_name ?? user.email.split("@")[0];

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-10 sm:py-14 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* Ficha */}
        <section className="flex flex-col items-center text-center lg:sticky lg:top-20">
          <div className="relative">
            {user.monitoring && (
              <>
                <span aria-hidden="true" className="radar-ping absolute inset-0 rounded-full border border-accent/60" />
                <span aria-hidden="true" className="radar-ring absolute -inset-1.5 rounded-full" />
              </>
            )}
            <div className={"relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full text-[34px] font-semibold text-accent " + (user.monitoring ? "border-2 border-paper bg-surface" : "border-2 border-dashed border-accent")}>
              {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
            </div>
            <span className={"absolute -right-1 -bottom-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide " + (pro ? "bg-accent text-black" : "bg-surface-2 text-muted")}>
              {tr(`account.plan.${pro ? "pro" : "free"}`)}
            </span>
          </div>
          <h1 className="mt-4 text-[26px] font-semibold tracking-[-0.025em] text-ink">{name}</h1>
          <p className="text-[14px] text-faint">{user.email}</p>
          <ProfileEditor messages={messages} name={name} avatar={user.avatar} email={user.email} />
          <ul className="mt-6 grid w-full grid-cols-3 divide-x divide-line rounded-card border border-line bg-surface">
            {[
              { v: lastScore ?? tr("profile.noScore"), l: tr("profile.score"), cls: lastScore !== null ? LEVEL_TEXT[levelFor(lastScore)] : "text-faint" },
              { v: list.filter((r) => r.status === "done").length, l: tr("profile.reports"), cls: "text-ink" },
              { v: lettersCount ?? 0, l: tr("profile.letters"), cls: "text-ink" },
            ].map((x) => (
              <li key={x.l} className="py-4">
                <p className={"text-[22px] font-semibold tracking-[-0.02em] " + x.cls}>{x.v}</p>
                <p className="mt-0.5 text-[12px] text-faint">{x.l}</p>
              </li>
            ))}
          </ul>
          <Link href="/herramientas" className="mt-4 text-[13px] font-medium text-accent underline underline-offset-4">
            {tr("tools.title")} →
          </Link>
        </section>

        <div className="mt-8 grid gap-4 lg:mt-0">
          {pago === "ok" && !pro && (
            <p className="rounded-[12px] bg-accent-soft px-4 py-3 text-[14px] leading-relaxed text-accent">
              {tr("pro.thanks")} {tr("pro.thanksPending")}
            </p>
          )}

          {/* Vigilancia: calendario de comprobaciones */}
          <VigilCalendar
            locale={locale}
            messages={messages}
            monitoring={user.monitoring}
            consentAt={user.monitoring_consent_at}
            lastAt={user.monitor_last_at}
            checks={checks}
            daily={dailyRows ?? []}
            justEnabled={vigilancia === "on" && user.monitoring}
          />

          {/* Rastro Equipos: consentimiento del miembro / acceso del titular */}
          {user.org_role === "member" && orgName && (
            <section className={CARD}>
              <p className="text-[15px] font-semibold text-ink">{tr("team.shareTitle")}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{tr("team.shareBody", { org: orgName })}</p>
              <form action="/api/org/share" method="post" className="mt-3">
                <input type="hidden" name="share" value={user.org_share_at ? "0" : "1"} />
                <button type="submit" className={user.org_share_at ? "text-[14px] font-medium text-muted underline underline-offset-4 hover:text-ink" : "rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90"}>{tr(user.org_share_at ? "team.shareOff" : "team.shareOn")}</button>
              </form>
            </section>
          )}
          {user.plan_kind === "team" && (
            <Link href="/equipo" className={CARD + " block hover:border-accent"}><p className="text-[15px] font-semibold text-ink">{tr("team.dashTitle")} →</p><p className="mt-1 text-[13.5px] text-muted">{tr("team.hubBody")}</p></Link>
          )}

          {/* Plan */}
          <section className={CARD}>
            {pro ? (
              <>
                <p className="text-[15px] font-semibold text-ink">{tr("pro.active")}</p>
                {user.plan_until && (
                  <p className="mt-1 text-[13px] text-muted">
                    {user.plan_status === "canceling"
                      ? tr("pro.canceling", { date: fmt.format(new Date(user.plan_until)) })
                      : tr("pro.until", { date: fmt.format(new Date(user.plan_until)) })}
                  </p>
                )}
                {user.plan_kind === "member" && familyOwner && (
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{tr("family.memberBody", { owner: familyOwner.email })}</p>
                )}
                {user.stripe_customer_id && user.plan_kind !== "member" && (
                  <form action="/api/stripe/portal" method="post" className="mt-3">
                    <button type="submit" className="text-[14px] font-medium text-accent underline underline-offset-4">{tr("pro.manage")}</button>
                  </form>
                )}
                {user.plan_kind === "family" && (
                  <div className="mt-4 border-t border-line pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[14px] font-semibold text-ink">{tr("family.title")}</p>
                      <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted">{tr("family.seats", { used: 1 + (familyMembers?.length ?? 0), total: FAMILY_SEATS })}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{tr("family.body")}</p>
                    {familia && familia !== "added" && familia !== "removed" && <p role="alert" className="mt-2 text-[13px] font-medium text-danger">{tr(`family.${familia}`)}</p>}
                    <ul className="mt-3 grid gap-1.5">
                      <li className="flex items-center justify-between rounded-[12px] bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink">{user.email} <span className="text-[12px] text-faint">{tr("family.you")}</span></li>
                      {(familyMembers ?? []).map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink">
                          <span className="min-w-0 truncate">{m.email}{!m.last_seen_at && <span className="ml-2 text-[12px] text-faint">{tr("family.pending")}</span>}</span>
                          <form action="/api/family" method="post"><input type="hidden" name="action" value="remove" /><input type="hidden" name="email" value={m.email} /><button type="submit" className="text-[12.5px] text-muted underline underline-offset-4 hover:text-ink">{tr("family.remove")}</button></form>
                        </li>
                      ))}
                    </ul>
                    {(familyMembers?.length ?? 0) < FAMILY_SEATS - 1 && (
                      <form action="/api/family" method="post" className="mt-3 flex gap-2">
                        <input type="hidden" name="action" value="add" />
                        <input name="email" type="email" required placeholder={tr("family.emailPlaceholder")} className="min-w-0 flex-1 rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
                        <button type="submit" className="shrink-0 rounded-[12px] bg-accent px-4 py-2.5 text-[14px] font-semibold text-black hover:opacity-90">{tr("family.add")}</button>
                      </form>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-ink">{tr("pro.locked")}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("pro.lockedBody", { monthly: prices().monthly, yearly: prices().yearly })}</p>
                <Link href="/pro" className="mt-3 inline-block rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90">
                  {tr("pro.lockedCta")}
                </Link>
              </>
            )}
          </section>

          {/* Soporte */}
          <section className={CARD + " flex flex-wrap items-center justify-between gap-3"}>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink">{tr("support.helpTitle")}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{tr("support.helpBody")}</p>
            </div>
            <Link href="/soporte" className="shrink-0 rounded-[12px] border border-line bg-surface-2 px-4 py-2.5 text-[14px] font-semibold text-ink hover:border-faint">{tr("support.button")}</Link>
          </section>

          {/* Informes */}
          <section>
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("account.reports")}</h2>
            {list.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted">{tr("account.empty")}</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {list.map((row) => {
                  const score = scoreOf(row);
                  const open = row.status === "done" || row.status === "processing" || row.status === "verified";
                  const inner = (
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-ink">
                          {row.full_name}
                          {row.city && <span className="font-normal text-muted"> · {row.city}</span>}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-faint">
                          {fmt.format(new Date(row.created_at))} · {tr(`account.status.${row.status}`)}
                        </p>
                      </div>
                      {score !== null ? (
                        <span className={"text-[26px] font-semibold tracking-[-0.03em] " + LEVEL_TEXT[levelFor(score)]}>{score}</span>
                      ) : (
                        <span className="text-[13px] text-faint">—</span>
                      )}
                    </div>
                  );
                  return (
                    <li key={row.id} className="rounded-card border border-line bg-surface px-4 py-3.5 sm:px-5">
                      {open ? <Link href={`/informe/${row.id}`} className="block">{inner}</Link> : inner}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link href="/#form" className="rounded-[12px] bg-accent px-5 py-3 text-[15px] font-semibold text-black hover:opacity-90">
              {tr("account.newReport")}
            </Link>
            <form action="/api/session/logout" method="post">
              <button type="submit" className="text-[14px] font-medium text-muted underline underline-offset-4 hover:text-ink">
                {tr("nav.logout")}
              </button>
            </form>
          </div>
        </div>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
