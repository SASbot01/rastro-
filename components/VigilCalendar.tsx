import Link from "next/link";
import { translator, type Locale, type Messages } from "@/lib/i18n";

const DAY = 86_400_000;
const EVERY_DAYS = 30;

interface Props {
  locale: Locale;
  messages: Messages;
  monitoring: boolean;
  consentAt: string | null;
  lastAt: string | null;
  checks: string[]; // fechas ISO de comprobaciones mensuales hechas
  daily: Array<{ day: string; status: "ok" | "alert" | "error" }>; // comprobaciones diarias recientes (14 dias)
  justEnabled: boolean; // recien activada: entrada animada
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Tarjeta "Vigilancia" del perfil: calendario del mes con las comprobaciones
 * hechas, hoy y la proxima; barra del ciclo de 30 dias. Solo CSS, sin JS.
 */
export function VigilCalendar({ locale, messages, monitoring, consentAt, lastAt, checks, daily, justEnabled }: Props) {
  const tr = translator(messages);
  const card = "rounded-card border border-line bg-surface p-5 sm:p-6";

  if (!monitoring) {
    return (
      <section className={card}>
        <p className="text-[15px] font-semibold text-ink">{tr("vigil.offTitle")}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">{tr("vigil.offBody")}</p>
        <Link href="/herramientas" className="mt-3 inline-block text-[14px] font-medium text-accent underline underline-offset-4">{tr("vigil.offCta")} →</Link>
      </section>
    );
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const since = consentAt ? new Date(consentAt) : today;
  const sinceDays = Math.max(0, Math.floor((today.getTime() - new Date(since.getFullYear(), since.getMonth(), since.getDate()).getTime()) / DAY));
  const anchor = lastAt ? new Date(lastAt) : since;
  const next = new Date(anchor.getTime() + EVERY_DAYS * DAY);
  const nextDay = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  const daysToNext = Math.max(0, Math.round((nextDay.getTime() - today.getTime()) / DAY));
  const progress = Math.min(100, Math.max(4, Math.round(((EVERY_DAYS - daysToNext) / EVERY_DAYS) * 100)));

  // Mes a mostrar: el actual, o el de la proxima comprobacion si cae en otro mes y queda cerca.
  const showNextMonth = nextDay.getMonth() !== today.getMonth() && daysToNext <= 10;
  const monthDate = showNextMonth ? nextDay : today;
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // lunes = 0
  const checkKeys = new Set(checks.map((c) => dayKey(new Date(c))));
  const consentKey = consentAt ? dayKey(since) : null;
  const todayKey = dayKey(today);
  const nextKey = dayKey(nextDay);

  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const dowFmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const dows = Array.from({ length: 7 }, (_, i) => dowFmt.format(new Date(2024, 0, 1 + i))); // 1-1-2024 fue lunes
  const cells: Array<number | null> = [...Array.from({ length: firstDow }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // Tira semanal (lunes a domingo de esta semana) con la comprobacion diaria de cada dia.
  const dailyByDay = new Map(daily.map((d) => [d.day, d.status]));
  const monday = new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * DAY);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { date: d, iso, status: dailyByDay.get(iso) ?? null, future: d > today, isToday: dayKey(d) === todayKey };
  });
  // Racha: dias seguidos "ok" contando hacia atras desde la ultima comprobacion.
  let streak = 0;
  for (const d of [...daily].sort((a, b) => (a.day < b.day ? 1 : -1))) {
    if (d.status === "ok") streak += 1;
    else if (d.status === "alert") break;
  }
  const hasDaily = daily.length > 0;
  const lastAlertToday = dailyByDay.get(week.find((w) => w.isToday)?.iso ?? "") === "alert";
  const checksCount = checks.length;

  return (
    <section className={card + (justEnabled ? " vigil-rise" : "")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span className="radar-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <h2 className="text-[16px] font-semibold text-ink">{tr("vigil.title")}</h2>
        </div>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black">{tr("vigil.active")}</span>
      </div>

      {justEnabled && <p className="mt-3 rounded-[12px] bg-accent-soft px-3.5 py-2.5 text-[13.5px] font-medium text-accent">{tr("vigil.justOn")}</p>}

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[14px] font-semibold text-ink">{sinceDays === 0 ? tr("vigil.sinceToday") : tr("vigil.since", { n: sinceDays })}</p>
        <p className="text-[12.5px] text-faint">{checksCount === 1 ? tr("vigil.check_one") : tr("vigil.checks", { n: checksCount })}</p>
      </div>

      {/* Tira semanal: comprobacion diaria */}
      <div className="mt-4 rounded-[14px] border border-line bg-surface-2 p-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">{tr("week.title")}</p>
          <p className={"text-[12.5px] font-semibold " + (lastAlertToday ? "text-warn" : "text-accent")}>
            {!hasDaily ? "" : lastAlertToday ? tr("week.streakZero") : streak === 1 ? tr("week.streakOne") : tr("week.streak", { n: streak })}
          </p>
        </div>
        <ul className="mt-3 grid grid-cols-7 gap-1">
          {week.map((w, i) => {
            const cls =
              w.status === "ok" ? "bg-accent" : w.status === "alert" ? "bg-warn" : w.status === "error" ? "bg-faint" : "bg-line";
            const label = w.status === "ok" ? tr("week.ok") : w.status === "alert" ? tr("week.alert") : tr("week.none");
            return (
              <li key={w.iso} className="flex flex-col items-center gap-1.5" title={`${dateFmt.format(w.date)} · ${label}`}>
                <span className={"text-[10.5px] font-medium uppercase " + (w.isToday ? "text-ink" : "text-faint")}>{dows[i]}</span>
                <span className={"relative flex h-7 w-7 items-center justify-center rounded-full " + (w.isToday ? "ring-1 ring-accent" : "")}>
                  <span className={"h-3 w-3 rounded-full " + cls + (w.future ? " opacity-30" : "") + (justEnabled ? " vigil-pop" : "")} style={justEnabled ? { animationDelay: `${120 + i * 40}ms` } : undefined} />
                  {w.status === "alert" && <span className="vigil-pulse absolute inset-0 rounded-full bg-warn opacity-40" />}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11.5px] leading-relaxed text-faint">{hasDaily ? tr("week.body") : tr("week.pending")}</p>
      </div>

      {/* Calendario */}
      <div className="mt-4 rounded-[14px] border border-line bg-surface-2 p-3.5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">{monthFmt.format(monthDate)}</p>
        <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
          {dows.map((d, i) => (
            <span key={i} className="text-[10.5px] font-medium uppercase text-faint">{d}</span>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <span key={`e${i}`} />;
            const key = `${y}-${m}-${day}`;
            const isToday = key === todayKey;
            const isNext = key === nextKey;
            const isCheck = checkKeys.has(key) || key === consentKey;
            const past = new Date(y, m, day) < today;
            let cls = "relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12.5px] ";
            if (isNext) cls += "bg-accent font-semibold text-black";
            else if (isCheck) cls += "bg-accent-soft font-semibold text-accent";
            else cls += past ? "text-faint" : "text-muted";
            if (isToday && !isNext) cls += " border border-accent font-semibold" + (isCheck ? "" : " text-ink");
            const anim = justEnabled && (isCheck || isNext || isToday) ? " vigil-pop" : "";
            return (
              <span key={key} className={cls + anim} style={anim ? { animationDelay: `${180 + i * 12}ms` } : undefined}>
                {isNext && <span className="vigil-pulse absolute inset-0 rounded-full bg-accent opacity-50" />}
                <span className="relative">{day}</span>
                {isCheck && !isNext && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent" />}
              </span>
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
          <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent-soft ring-1 ring-accent/50" />{tr("vigil.legend.check")}</li>
          <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-accent" />{tr("vigil.legend.today")}</li>
          <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" />{tr("vigil.legend.next")}</li>
        </ul>
      </div>

      {/* Ciclo de 30 dias */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
          <span className="text-muted">{tr("vigil.next")}</span>
          <span className="font-semibold text-ink">
            {dateFmt.format(nextDay)} <span className="font-normal text-faint">· {daysToNext === 0 ? tr("vigil.today") : tr("vigil.inDays", { n: daysToNext })}</span>
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}
