"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { translator, type Messages } from "@/lib/i18n";
import { ScoreRing } from "./ScoreRing";

/** Native modal: focus trap, Escape and focus restoration are browser managed. */
export function ReportReveal({ score, count, messages, onClose }: { score: number; count: number; messages: Messages; onClose: () => void }) {
  const tr = translator(messages);
  const dialog = useRef<HTMLDialogElement>(null);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const node = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.showModal();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = reduced ? null : window.setInterval(() => setStage((s) => Math.min(2, s + 1)), 6500);
    return () => { if (timer !== null) clearInterval(timer); node?.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialog} onCancel={onClose} className="ex-reveal" aria-labelledby="reveal-title">
    <div className="ex-reveal-top"><span className="ex-wordmark">rastro<span>®</span></span><button className="ex-quiet" onClick={onClose} autoFocus>{tr("experience.skip")} ↗</button></div>
    <div className="ex-reveal-content" key={stage}>
      {stage === 0 ? <Image src="/brand/mascot-560.webp" alt="" width={240} height={240} priority /> : stage === 1 ? <div className="ex-reveal-count">{count.toString().padStart(2, "0")}</div> : <ScoreRing score={score} size={240} label={tr("experience.score")} />}
      <p className="ex-eyebrow">{tr("experience.label")}</p>
      <h2 id="reveal-title">{tr(stage === 0 ? "experience.revealIntro" : stage === 1 ? "experience.revealCount" : "experience.revealScore", { n: count })}</h2>
      <p>{tr(stage === 2 ? "experience.highScore" : "experience.revealBody")}</p>
      <button className="ex-button" onClick={() => stage < 2 ? setStage(stage + 1) : onClose()}>{tr(stage === 2 ? "experience.revealCta" : "experience.next")} <span aria-hidden="true">→</span></button>
    </div>
    <div className="ex-reveal-bottom"><div className="ex-progress-segments" aria-hidden="true">{[0,1,2].map((s) => <i key={s} data-active={s <= stage} />)}</div><p>{tr("experience.reduced")}</p></div>
  </dialog>;
}
