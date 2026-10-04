import type { LetterEvent } from "@/lib/letters";
import { translator, type Locale, type Messages } from "@/lib/i18n";

export function LetterJourney({ events, messages, locale, checkedAt, stillListed }: { events: LetterEvent[]; messages: Messages; locale: Locale; checkedAt?: string | null; stillListed?: boolean | null }) {
  const tr = translator(messages);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  return <div className="grid gap-4">
    {checkedAt && stillListed === false && <section className="ex-panel ex-victory"><span className="ex-badge">✓ {tr("experience.verified")}</span><h2>{tr("experience.victory")}</h2><p className="ex-note">{tr("experience.victoryBody")}</p><div className="ex-before-after"><div><span>{tr("experience.before")}</span><p>{tr("experience.beforeText")}</p></div><div><span>{tr("experience.after")}</span><p>{tr("experience.afterText")}</p><time className="ex-note" dateTime={checkedAt}>{fmt.format(new Date(checkedAt))}</time></div></div></section>}
    <section className="ex-panel"><p className="ex-eyebrow">{tr("letters.timeline")}</p><h2 className="mt-3 text-xl font-medium tracking-tight">{tr("experience.letterJourney")}</h2><p className="ex-note mt-2">{tr("experience.letterJourneyBody")}</p><ol className="ex-timeline">{[...events].sort((a,b) => a.at.localeCompare(b.at)).map((event, i) => <li key={`${event.at}-${i}`}><span className="ex-timeline-dot" aria-hidden="true"/><div><h3>{tr(`letters.event.${event.type}`, { to: event.to ?? "" })}</h3><time dateTime={event.at}>{fmt.format(new Date(event.at))}</time></div></li>)}</ol></section>
  </div>;
}
