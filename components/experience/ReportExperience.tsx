"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ReportData } from "@/components/ReportView";
import { GuideChecklist } from "@/components/GuideChecklist";
import { translator, type Locale, type Messages } from "@/lib/i18n";
import { levelFor } from "@/lib/report/score";
import { actionableFindings, captureSummary, CATEGORIES, reportCounts, safeSource, sourceHost } from "@/lib/report/presentation";
import { ShareButton } from "@/components/ShareButton";
import { LEVEL_RGB, ScoreRing } from "./ScoreRing";
import { ReportReveal } from "./ReportReveal";
import { ReportStories } from "./ReportStories";
import { EmptyState } from "./EmptyState";

type Mode = "overview" | "stories" | "mirror" | "assistants" | "details";
const RIGHTS = { openai: "https://privacy.openai.com/", gemini: "https://support.google.com/legal/troubleshooter/1114905", perplexity: "https://www.perplexity.ai/hub/legal/privacy-policy" };

export function ReportExperience({ report, requestId, fullName, messages, locale, children, pro = false, reveal = false, demo = false }: {
  report: ReportData; requestId: string; fullName: string; messages: Messages; locale: Locale; children?: ReactNode; pro?: boolean; reveal?: boolean; demo?: boolean;
}) {
  const tr = translator(messages);
  const [mode, setMode] = useState<Mode>("overview");
  const [capturing, setCapturing] = useState(false);
  const [revealing, setRevealing] = useState(reveal);
  const [storyStart, setStoryStart] = useState(0);
  const [exportError, setExportError] = useState(false);
  useEffect(() => {
    if (capturing) document.documentElement.setAttribute("data-rastro-capture", "true");
    return () => document.documentElement.removeAttribute("data-rastro-capture");
  }, [capturing]);
  const findings = actionableFindings(report.findings);
  const counts = reportCounts(report.findings);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(report.created_at));
  const modes: Mode[] = ["overview", "stories", "mirror", "assistants", ...(children ? ["details" as const] : [])];

  function openStory(index: number) { setStoryStart(index); setMode("stories"); }
  function closeReveal() {
    setRevealing(false);
    // Remove only the one-shot flag. Refreshing or returning won't replay it.
    const url = new URL(window.location.href);
    if (url.searchParams.has("reveal")) { url.searchParams.delete("reveal"); window.history.replaceState(null, "", url.pathname + url.search + url.hash); }
  }
  async function downloadCard() {
    setExportError(false);
    try {
      // No report text or source is passed into the canvas export.
      const summary = captureSummary(report.score, report.findings);
      const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("canvas");
      await document.fonts.ready;
      ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, 1080, 1920);
      ctx.fillStyle = "#4dfc5f"; ctx.font = "600 65px Inter, sans-serif"; ctx.fillText("rastro®", 88, 145);
      ctx.fillStyle = "#a3a39e"; ctx.font = "28px Inter, sans-serif"; ctx.fillText(tr("experience.label"), 88, 310);
      ctx.strokeStyle = "#262626"; ctx.lineWidth = 25; ctx.beginPath(); ctx.arc(540, 780, 285, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = summary.score >= 70 ? "#4dfc5f" : summary.score >= 40 ? "#ffb020" : "#ff5f5f";
      ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(540, 780, 285, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * summary.score / 100); ctx.stroke();
      ctx.fillStyle = "#f4f4f2"; ctx.textAlign = "center"; ctx.font = "600 200px Inter, sans-serif"; ctx.fillText(String(summary.score), 540, 815);
      ctx.fillStyle = "#a3a39e"; ctx.font = "38px Inter, sans-serif"; ctx.fillText("/ 100", 540, 890);
      ctx.font = "32px Inter, sans-serif"; ctx.fillText(tr("experience.highScore"), 540, 1170);
      ctx.fillStyle = "#f4f4f2"; ctx.font = "600 44px Inter, sans-serif"; ctx.fillText(`${summary.total} · ${tr("experience.findings")}`, 540, 1330);
      ctx.fillStyle = "#a3a39e"; ctx.font = "28px Inter, sans-serif"; ctx.fillText(tr("experience.captureOn"), 540, 1440);
      if (demo) { ctx.fillStyle = "#ffb020"; ctx.fillText(tr("experience.demoBadge"), 540, 1540); }
      ctx.fillStyle = "#4dfc5f"; ctx.font = "600 42px Inter, sans-serif"; ctx.fillText("rastropro.com", 540, 1750);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("blob")), "image/png"));
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "rastro-story.png"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { setExportError(true); }
  }

  if (capturing) return <div className="ex-capture-wrap">
    <div className="ex-capture"><span className="ex-wordmark">rastro<span>®</span></span><p className="ex-eyebrow">{tr("experience.label")}</p><h1>{tr("experience.title")}</h1><ScoreRing score={report.score} label={tr("experience.score")} size={250} /><p>{tr("experience.highScore")}</p><div className="ex-capture-counts"><div><strong>{counts.total}</strong><span>{tr("experience.findings")}</span></div><div><strong>{counts.sources}</strong><span>{tr("experience.sources")}</span></div></div><span className="ex-badge">{tr(demo ? "experience.demoBadge" : "experience.captureOn")}</span><p className="ex-capture-domain">rastropro.com</p></div>
    <p className="ex-note">{tr("experience.captureHint")}</p><div className="ex-actions"><button className="ex-button" onClick={downloadCard}>{tr("experience.export")} ↓</button><button className="ex-button-secondary" onClick={() => setCapturing(false)}>{tr("experience.exitCapture")}</button></div>{exportError && <p role="alert">{tr("experience.exportError")}</p>}
  </div>;

  return <div className="ex-report">
    <div className="ex-page-heading"><div><p className="ex-eyebrow">{tr("experience.label")}</p><h1>{tr("experience.title")}</h1><p>{tr("experience.subtitle")}</p></div><button className="ex-button-secondary" onClick={() => setCapturing(true)}><span aria-hidden="true">▣</span> {tr("experience.capture")}</button></div>
    <div className="ex-tabs" role="group" aria-label={tr("report.eyebrow")}>{modes.map((m) => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{tr(`experience.${m}`)}</button>)}</div>

    {mode === "overview" && <>
      <section className="ex-report-hero rise" style={{ "--score-rgb": LEVEL_RGB[levelFor(report.score)] } as CSSProperties}>
        <div className="ex-hero-text"><span className="ex-badge"><span className="ex-dot" />{tr("experience.private")}</span><h2>{fullName}</h2><p className="ex-hero-summary">{report.summary}</p><p className="ex-note">{date} · {tr("experience.highScore")}</p><div className="ex-actions"><button className="ex-button" onClick={() => openStory(0)}>{tr("experience.stories")} <span aria-hidden="true">↗</span></button>{!demo && <ShareButton requestId={requestId} score={report.score} messages={messages} compact />}<button className="ex-quiet" onClick={() => setRevealing(true)}>{tr("experience.replay")} <span aria-hidden="true">▷</span></button></div></div>
        <div className="ex-hero-score"><ScoreRing score={report.score} label={tr("experience.score")} size={214} /><span className={`ex-level ex-level-${levelFor(report.score)}`}>{tr(`report.level.${levelFor(report.score)}`)}</span></div>
      </section>
      <div className="ex-stat-grid">{CATEGORIES.map((c, i) => <button className="ex-stat rise" style={{ "--i": i + 1 } as CSSProperties} key={c} onClick={() => { const first = findings.findIndex((f) => f.category === c); if (first >= 0) openStory(first); }} disabled={!counts.categories[c]}><span className="ex-stat-icon" aria-hidden="true">{["◈", "✳", "◎", "≈"][i]}</span><strong>{counts.categories[c]}</strong><span>{tr(`report.categories.${c}`)}</span><span className="ex-stat-arrow" aria-hidden="true">↗</span></button>)}</div>
      <div className="ex-two-col"><section className="ex-panel"><div className="ex-section-title"><h2>{tr("experience.atlas")}</h2><span className="ex-badge">{counts.sources}</span></div><p className="ex-note">{tr("experience.atlasHint")}</p><div className="ex-atlas"><div className="ex-atlas-orbit" aria-hidden="true"/><div className="ex-atlas-center"><Image src="/brand/logo-96.png" alt="" width={30} height={30}/><span>{tr("experience.atlasCenter")}</span></div><div className="ex-source-list">{findings.slice(0, 6).map((f, i) => <button key={i} onClick={() => openStory(i)}><i className={`ex-source-dot ex-severity-${f.severity}`} /><span>{sourceHost(f.source_url) ?? tr(`report.categories.${f.category}`)}</span><span aria-hidden="true">↗</span></button>)}</div></div>{!findings.length && <EmptyState title={tr("experience.storyEmpty")} body={tr("experience.emptyBody")} />}</section>
        <section className="ex-panel"><div className="ex-section-title"><h2>{tr("experience.missions")}</h2><span aria-hidden="true">↗</span></div><p className="ex-note">{tr("experience.missionHint")}</p>{report.actions.length ? <div className="mt-5"><GuideChecklist key={requestId} reportId={requestId} items={report.actions} doneTemplate={tr("dash.guideDone")} /></div> : <EmptyState title={tr("experience.emptyTitle")} body={tr("experience.emptyBody")} />}</section></div>
      <div className="ex-companion"><Image src="/brand/mascot-112.png" alt="" width={72} height={72}/><div><h2>{tr("experience.mirrorTitle")}</h2><p>{tr("experience.mirrorNote")}</p></div><button className="ex-button-secondary" onClick={() => setMode("mirror")}>{tr("experience.mirror")} ↗</button></div>
    </>}
    {mode === "stories" && <ReportStories key={storyStart} findings={findings} initialIndex={storyStart} messages={messages} onFinish={() => setMode("overview")} />}
    {mode === "mirror" && <section className="ex-mirror ex-panel"><div className="ex-section-title"><span className="ex-eyebrow">{tr("experience.mirrorLabel")}</span><span className="ex-badge">{tr("experience.private")}</span></div><div className="ex-mirror-identity"><div className="ex-avatar" aria-hidden="true">{fullName.slice(0, 1)}</div><div><h2>{fullName}</h2><p>{date}</p></div><ScoreRing score={report.score} label={tr("experience.score")} size={92} /></div><h3>{tr("experience.mirrorTitle")}</h3><p className="ex-note">{tr("experience.mirrorBody")}</p><div className="ex-mirror-grid">{findings.map((f, i) => <article key={i}><span className="ex-eyebrow">{tr(`report.categories.${f.category}`)}</span><h4>{f.title}</h4><p>{f.detail}</p>{safeSource(f.source_url) && <a className="ex-text-link" href={safeSource(f.source_url)!} rel="noopener noreferrer nofollow" target="_blank">{sourceHost(f.source_url)} ↗</a>}</article>)}</div>{!findings.length && <EmptyState title={tr("experience.mirrorEmpty")} body={tr("experience.emptyBody")} />}<p className="ex-note">{tr("experience.mirrorNote")}</p><button className="ex-button-secondary" onClick={() => setCapturing(true)}>{tr("experience.capture")}</button></section>}
    {mode === "assistants" && <section className="ex-panel ex-chat"><p className="ex-note">{tr("experience.chatHint")}</p><div className="ex-chat-question">{tr("experience.chatQuestion", { name: fullName })}</div>{report.assistants?.length ? report.assistants.map((a) => <article className="ex-chat-answer" key={a.provider}><div className="ex-chat-provider"><span aria-hidden="true">{a.provider === "openai" ? "◎" : a.provider === "gemini" ? "✦" : "✳"}</span><h2>{tr(`report.assistantNames.${a.provider}`)}</h2><span className="ex-note">{date}</span></div>{a.status === "ok" ? <><blockquote>{a.answer}</blockquote><div className="ex-chat-sources">{a.sources.filter((s) => safeSource(s.url)).slice(0, 5).map((s, i) => <a href={safeSource(s.url)!} target="_blank" rel="noopener noreferrer nofollow" key={i}>{sourceHost(s.url)} ↗</a>)}</div><div className="ex-actions">{demo ? <p className="ex-note">{tr("experience.demoAction")}</p> : pro ? <form method="post" action="/api/ai-requests"><input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="provider" value={a.provider}/><button className="ex-button-secondary" type="submit">{tr("experience.false")} ↗</button></form> : <Link className="ex-button-secondary" href="/pro">{tr("experience.false")} · Pro</Link>}<a className="ex-text-link" href={RIGHTS[a.provider]} target="_blank" rel="noopener noreferrer">{tr("experience.portal")} ↗</a></div></> : <p className="ex-note">{tr("experience.unavailable")}</p>}</article>) : <EmptyState title={tr("experience.chatEmpty")} body={tr("experience.emptyBody")} />}</section>}
    {mode === "details" && children}
    {revealing && <ReportReveal messages={messages} score={report.score} count={counts.total} onClose={closeReveal} />}
  </div>;
}
