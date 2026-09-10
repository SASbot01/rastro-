import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase";
import { levelFor } from "@/lib/report/score";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  full_name: string;
  city: string | null;
  status: string;
  created_at: string;
  reports: { score: number } | { score: number }[] | null;
}

const LEVEL_TEXT = { green: "text-ok", orange: "text-accent", red: "text-danger" } as const;

function scoreOf(row: Row): number | null {
  const r = Array.isArray(row.reports) ? row.reports[0] : row.reports;
  return r ? r.score : null;
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/entrar");

  const user = await findUserByEmail(session.email);
  if (!user) redirect("/entrar");

  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const { data: rows } = await supabaseAdmin()
    .from("requests")
    .select("id, full_name, city, status, created_at, reports(score)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Row[]>();

  const list = rows ?? [];

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] px-5 py-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-ink">{tr("account.title")}</h1>
            <p className="mt-1 text-[13px] text-faint">{tr("account.signedInAs", { email: user.email })}</p>
          </div>
          <span className="rounded-full bg-paper px-3 py-1 text-[12px] font-semibold text-muted">
            {tr(`account.plan.${user.plan}`)}
          </span>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">{tr("account.subtitle")}</p>

        <h2 className="mt-10 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("account.reports")}</h2>

        {list.length === 0 ? (
          <p className="mt-4 text-[15px] text-muted">{tr("account.empty")}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {list.map((row) => {
              const score = scoreOf(row);
              return (
                <li key={row.id} className="rounded-card border border-line bg-surface p-4 sm:p-5">
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
                      <span className={"text-[28px] font-semibold tracking-[-0.03em] " + LEVEL_TEXT[levelFor(score)]}>{score}</span>
                    ) : (
                      <span className="text-[13px] text-faint">—</span>
                    )}
                  </div>
                  {(row.status === "done" || row.status === "processing" || row.status === "verified") && (
                    <Link href={`/informe/${row.id}`} className="mt-3 inline-block text-[13px] font-medium text-accent underline underline-offset-4">
                      {tr("account.view")}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/#form" className="rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-white hover:opacity-90">
            {tr("account.newReport")}
          </Link>
          <form action="/api/session/logout" method="post">
            <button type="submit" className="text-[14px] font-medium text-muted underline underline-offset-4 hover:text-ink">
              {tr("nav.logout")}
            </button>
          </form>
        </div>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
