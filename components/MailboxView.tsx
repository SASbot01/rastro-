"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { translator, type Locale, type Messages } from "@/lib/i18n";
import type { MailboxService } from "@/lib/mailbox/scan";

const POLL_MS = 2000;

interface Scan {
  id: string;
  mailbox: string;
  status: "processing" | "done" | "error";
  step: string | null;
  messages_seen: number;
  messages_total?: number | null;
  services: MailboxService[];
  started_at: string;
}

const KIND_ORDER: MailboxService["kind"][] = ["account", "receipt", "newsletter", "other"];

export function MailboxView({ scan, locale, messages, pro }: { scan: Scan; locale: Locale; messages: Messages; pro: boolean }) {
  const tr = translator(messages);
  const router = useRouter();
  const [live, setLive] = useState({ status: scan.status, step: scan.step, seen: scan.messages_seen, total: scan.messages_total ?? null });
  const [filter, setFilter] = useState<MailboxService["kind"] | "all">("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (scan.status !== "processing") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/mailbox/${scan.id}`, { cache: "no-store" });
        const b = (await r.json()) as { status: Scan["status"]; step: string | null; messages_seen: number; messages_total: number | null };
        setLive({ status: b.status, step: b.step, seen: b.messages_seen, total: b.messages_total });
        if (b.status !== "processing") {
          clearInterval(t);
          router.refresh();
        }
      } catch {
        /* reintento en el siguiente tick */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [scan.id, scan.status, router]);

  const fmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const card = "card";

  if (live.status === "processing") {
    return (
      <div className={card + " p-6 sm:p-8"}>
        <p className="eyebrow">{tr("mailbox.scanning")}</p>
        <h1 className="mt-2 h2 text-ink">{scan.mailbox}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("mailbox.scanningBody")}</p>
        <p className="mt-5 flex items-center gap-2 text-[14px] text-ink">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          {tr(`mailbox.step.${live.step ?? "listing"}`)}
          {live.seen > 0 && <span className="text-faint">· {live.total ? tr("mailbox.seenOf", { n: live.seen, total: live.total }) : tr("mailbox.seen", { n: live.seen })}</span>}
        </p>
      </div>
    );
  }

  if (live.status === "error") {
    return (
      <div className={card + " p-6 sm:p-8"}>
        <h1 className="h2 text-ink">{tr("mailbox.errorTitle")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("mailbox.errorBody")}</p>
      </div>
    );
  }

  const counts = Object.fromEntries(KIND_ORDER.map((k) => [k, scan.services.filter((s) => s.kind === k).length])) as Record<string, number>;
  const shown = scan.services
    .filter((s) => filter === "all" || s.kind === filter)
    .filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.domain.includes(q.toLowerCase()));
  const oldCutoff = new Date(scan.started_at).getTime() - 2 * 365 * 86_400_000;

  return (
    <div className="grid gap-4">
      <div className={card + " p-6 sm:p-8"}>
        <p className="eyebrow">{tr("mailbox.doneEyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">
          {tr("mailbox.doneTitle", { n: scan.services.length })}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {tr("mailbox.doneBody", { mailbox: scan.mailbox, seen: scan.messages_seen })}
        </p>
        <p className="mt-3 text-[12.5px] text-faint">{tr("mailbox.privacyNote")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", ...KIND_ORDER.filter((k) => counts[k] > 0)] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={"rounded-full px-3 py-1.5 text-[13px] font-medium " + (filter === k ? "bg-ink text-white" : "bg-surface text-muted border border-line hover:text-ink")}
          >
            {k === "all" ? tr("mailbox.all") : tr(`mailbox.kind.${k}`)} {k === "all" ? scan.services.length : counts[k]}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("mailbox.search")}
          className="field ml-auto !min-h-[44px] max-w-[240px] !rounded-full !py-2"
        />
      </div>

      <ul className="grid gap-2">
        {shown.map((s) => {
          const old = s.last_seen ? Date.parse(s.last_seen) < oldCutoff : false;
          return (
            <li key={s.domain} className={card + " flex flex-wrap items-center justify-between gap-3 px-4 py-3"}>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <span className="truncate">{s.name}</span>
                  <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide " + (s.kind === "account" ? "bg-accent-soft text-accent" : "bg-paper text-faint")}>
                    {tr(`mailbox.kind.${s.kind}`)}
                  </span>
                  {old && <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">{tr("mailbox.old")}</span>}
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-faint">
                  {s.domain} · {s.messages} {tr("mailbox.msgs")}
                  {s.first_seen && ` · ${fmt.format(new Date(s.first_seen))}`}
                  {s.last_seen && s.first_seen !== s.last_seen && ` → ${fmt.format(new Date(s.last_seen))}`}
                </p>
              </div>
              {pro && (
                <form action="/api/letters" method="post">
                  <input type="hidden" name="host" value={s.domain} />
                  <input type="hidden" name="mailbox_scan_id" value={scan.id} />
                  <button type="submit" className="link text-[14px]">
                    {tr("mailbox.closeLetter")}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="text-[14px] text-muted">{tr("mailbox.none")}</p>}
    </div>
  );
}
