import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { MailboxView } from "@/components/MailboxView";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { isPro } from "@/lib/plan";
import { googleConfigured } from "@/lib/google";
import type { MailboxService } from "@/lib/mailbox/scan";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ScanRow {
  id: string;
  mailbox: string;
  status: "processing" | "done" | "error";
  step: string | null;
  messages_seen: number;
  messages_total: number | null;
  services: MailboxService[];
  started_at: string;
}

/** Escaner de buzon: conectar Gmail, ver el progreso y la lista de servicios. */
export default async function MailboxPage({ searchParams }: PageProps<"/cuenta/buzon">) {
  const { scan: scanParam, e } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/entrar");
  const user = await findUserByEmail(session.email);
  if (!user) redirect("/entrar");

  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const pro = isPro(user);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  const supabase = supabaseAdmin();
  const { data: scans } = await supabase
    .from("mailbox_scans")
    .select("id, mailbox, status, step, messages_seen, messages_total, services, started_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(10)
    .returns<ScanRow[]>();
  const list = scans ?? [];
  const current = (typeof scanParam === "string" && UUID.test(scanParam) ? list.find((s) => s.id === scanParam) : null) ?? list[0] ?? null;

  const errorKey = typeof e === "string" && ["denied", "state", "scope", "google", "db", "config"].includes(e) ? e : null;

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-10 sm:py-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="h2 text-ink">{tr("mailbox.title")}</h1>
            <p className="mt-1 text-[14px] text-muted">{tr("mailbox.subtitle")}</p>
          </div>
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">{tr("mailbox.beta")}</span>
        </div>

        {errorKey && (
          <p className="mb-5 rounded-[10px] bg-accent-soft px-4 py-3 text-[14px] leading-relaxed text-accent">{tr(`mailbox.errors.${errorKey}`)}</p>
        )}

        {!pro ? (
          <div className="card p-6">
            <p className="text-[15px] font-semibold text-ink">{tr("pro.locked")}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("mailbox.proBody")}</p>
            <Link href="/pro" className="mt-4 btn btn-primary">
              {tr("pro.lockedCta")}
            </Link>
          </div>
        ) : (
          <>
            {current && <MailboxView scan={current} locale={locale} messages={messages} pro={pro} />}

            {(!current || current.status !== "processing") && (
              <section className="mt-6 card p-6">
                <h2 className="text-[15px] font-semibold text-ink">{current ? tr("mailbox.rescan") : tr("mailbox.connectTitle")}</h2>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("mailbox.connectBody")}</p>
                <ul className="mt-3 grid gap-1.5 text-[13px] leading-relaxed text-muted">
                  {(messages.mailbox.promises as string[]).map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
                <form action="/api/google/start" method="post" className="mt-5">
                  <button
                    type="submit"
                    disabled={!googleConfigured()}
                    className="btn btn-primary"
                  >
                    {tr("mailbox.connect")}
                  </button>
                  {!googleConfigured() && <p className="mt-2 text-[12.5px] text-faint">{tr("mailbox.errors.config")}</p>}
                </form>
                <p className="mt-3 text-[12px] text-faint">{tr("mailbox.testersNote")}</p>
              </section>
            )}

            {list.length > 1 && (
              <section className="mt-6">
                <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-muted">{tr("mailbox.history")}</h2>
                <ul className="mt-3 grid gap-2">
                  {list.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 text-[14px]">
                      <span className="text-muted">
                        {fmt.format(new Date(s.started_at))} · {s.mailbox} · {s.status === "done" ? tr("mailbox.doneTitle", { n: s.services.length }) : tr(`mailbox.status.${s.status}`)}
                      </span>
                      {s.id !== current?.id && (
                        <Link href={`/cuenta/buzon?scan=${s.id}`} className="shrink-0 font-medium text-accent underline underline-offset-4">
                          {tr("letters.open")}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <Link href="/cuenta" className="mt-8 inline-block link-muted text-[14px]">
          {tr("nav.account")}
        </Link>
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}
