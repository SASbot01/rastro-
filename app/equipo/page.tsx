import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { levelFor } from "@/lib/report/score";
import { memberSnapshots, orgForOwner, orgMembers } from "@/lib/org";
import { sharedMonitoring } from "@/lib/team-privacy";

export const dynamic = "force-dynamic";
const CARD = "card p-5 sm:p-6";
const FIELD = "field min-w-0 flex-1 !min-h-[48px]";
const LEVEL_TEXT = { green: "text-ok", orange: "text-warn", red: "text-danger" } as const;

/** v5 — Panel de Rastro Equipos (solo titular). Ve lo que cada persona comparte: puntuacion, contrasenas filtradas, vigilancia. */
export default async function TeamPage({ searchParams }: PageProps<"/equipo">) {
  const { e, ok } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/entrar");
  const user = await findUserByEmail(session.email);
  if (!user) redirect("/entrar");
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  if (user.plan_kind !== "team") redirect("/equipos");

  const org = await orgForOwner(user);
  const members = org ? await orgMembers(org.id) : [];
  const snaps = await memberSnapshots(members.filter((m) => m.org_share_at).map((m) => m.id));
  const shared = members.filter((m) => m.org_share_at && snaps.has(m.id));
  const avg = shared.length ? Math.round(shared.reduce((a, m) => a + (snaps.get(m.id)?.score ?? 0), 0) / shared.length) : null;
  const withPw = shared.filter((m) => (snaps.get(m.id)?.passwords ?? 0) > 0).length;

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-8 sm:py-12">
        <p className="eyebrow">{tr("team.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{org ? org.name : tr("team.dashTitle")}</h1>
        <section className="ex-panel mt-5"><h2 className="text-base font-medium">{tr("experience.teamPrivacy")}</h2><p className="ex-note mt-2">{tr("experience.teamPrivacyBody")}</p></section>
        {e && <p role="alert" className="mt-3 text-[13px] font-medium text-danger">{tr(`team.${e}`)}</p>}

        {/* Nombre / creacion */}
        <form action="/api/org" method="post" className="mt-4 flex gap-2">
          <input name="name" required minLength={2} maxLength={80} defaultValue={org?.name ?? ""} placeholder={tr("team.nameLabel")} className={FIELD} />
          <button type="submit" className="shrink-0 btn btn-secondary btn-sm">{tr("team.rename")}</button>
        </form>

        {org && (
          <>
            <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { v: avg ?? "—", l: tr("team.avg"), cls: avg !== null ? LEVEL_TEXT[levelFor(avg)] : "text-faint" },
                { v: `${withPw}/${shared.length}`, l: tr("team.withPasswords"), cls: withPw ? "text-danger" : "text-ink" },
                { v: `${shared.length}/${members.length}`, l: tr("team.withReport"), cls: "text-ink" },
                { v: `${members.filter((m) => sharedMonitoring(m) === true).length}/${members.filter((m) => m.org_share_at).length}`, l: tr("team.withMonitoring"), cls: "text-ink" },
              ].map((x) => (
                <li key={x.l} className={CARD + " !p-4"}><p className={"text-[24px] font-semibold tracking-[-0.02em] " + x.cls}>{x.v}</p><p className="mt-0.5 text-[12px] text-faint">{x.l}</p></li>
              ))}
            </ul>

            <section className={CARD + " mt-4"}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold text-ink">{tr("team.dashTitle")}</h2>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted">{tr("team.seats", { used: 1 + members.length, total: org.seats })}</span>
                  <a href="/api/org/export" className="link text-[14px]">{tr("team.export")}</a>
                </div>
              </div>
              {ok === "added" && <p className="mt-2 text-[13px] text-accent">{tr("family.pending")}</p>}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13.5px]">
                  <thead><tr className="text-left text-[11px] uppercase tracking-[0.08em] text-faint">
                    <th className="py-2 pr-3 font-semibold">{tr("team.col.person")}</th><th className="py-2 pr-3 font-semibold">{tr("team.col.status")}</th><th className="py-2 pr-3 font-semibold">{tr("team.col.score")}</th><th className="py-2 pr-3 font-semibold">{tr("team.col.passwords")}</th><th className="py-2 pr-3 font-semibold">{tr("team.col.monitoring")}</th><th className="py-2 pr-3 font-semibold">{tr("team.col.updated")}</th><th />
                  </tr></thead>
                  <tbody className="divide-y divide-line">
                    {members.map((m) => {
                      const s = m.org_share_at ? snaps.get(m.id) : undefined;
                      return (
                        <tr key={m.id}>
                          <td className="py-2.5 pr-3 text-ink">{m.email}</td>
                          <td className="py-2.5 pr-3 text-muted">{!m.last_seen_at ? tr("team.status.invited") : m.org_share_at ? (s ? tr("team.status.active") : tr("team.status.noreport")) : tr("team.notShared")}</td>
                          <td className={"py-2.5 pr-3 font-semibold " + (s ? LEVEL_TEXT[levelFor(s.score)] : "text-faint")}>{s ? s.score : "—"}</td>
                          <td className={"py-2.5 pr-3 " + (s && s.passwords > 0 ? "text-danger" : "text-muted")}>{s ? s.passwords : "—"}</td>
                          <td className="py-2.5 pr-3 text-muted">{sharedMonitoring(m) === null ? "—" : sharedMonitoring(m) ? tr("team.on") : tr("team.off")}</td>
                          <td className="py-2.5 pr-3 text-faint">{s ? fmt.format(new Date(s.at)) : "—"}</td>
                          <td className="py-2.5 text-right"><form action="/api/org/members" method="post"><input type="hidden" name="action" value="remove" /><input type="hidden" name="email" value={m.email} /><button type="submit" className="text-[12.5px] text-muted underline underline-offset-4 hover:text-ink">{tr("team.remove")}</button></form></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {members.length < org.seats - 1 && (
                <form action="/api/org/members" method="post" className="mt-4 flex gap-2">
                  <input type="hidden" name="action" value="add" />
                  <input name="email" type="email" required placeholder={tr("team.emailPlaceholder")} className={FIELD} />
                  <button type="submit" className="shrink-0 btn btn-primary btn-sm">{tr("team.invite")}</button>
                </form>
              )}
            </section>
          </>
        )}
        <p className="mt-6 text-[13px]"><Link href="/cuenta" className="font-medium text-muted underline underline-offset-4 hover:text-ink">{tr("nav.account")}</Link></p>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
