"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { translator, type Messages } from "@/lib/i18n";

export function Onboarding({ messages, initialDone, children }: { messages: Messages; initialDone: boolean; children: ReactNode }) {
  const tr = translator(messages);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(initialDone);
  function finish() {
    // Device preference only, read on the server on future visits.
    // eslint-disable-next-line react-hooks/immutability -- cookie API in an explicit user event
    document.cookie = "rastro_onboarded=1;path=/;max-age=31536000;samesite=lax";
    setDone(true);
  }
  if (done) return children;
  return <section className="ex-panel ex-onboarding"><div className="ex-section-title"><span className="ex-badge">{tr("experience.step", { current:step,total:3 })}</span><button className="ex-quiet" onClick={finish}>{tr("experience.onboardingSkip")} ↗</button></div><Image src="/brand/mascot-192.png" alt="" width={150} height={150}/><div aria-live="polite" aria-atomic="true"><h3>{tr(`experience.onboardingTitle${step}`)}</h3><p>{tr(`experience.onboardingBody${step}`)}</p></div><div className="ex-actions">{step > 1 && <button className="ex-button-secondary" onClick={() => setStep(step - 1)}>← {tr("experience.previous")}</button>}<button className="ex-button" onClick={() => step === 3 ? finish() : setStep(step + 1)}>{tr(step === 3 ? "experience.onboardingStart" : "experience.next")} →</button></div></section>;
}
