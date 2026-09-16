"use client";

import { useState } from "react";
import Link from "next/link";
import { translator, type Messages } from "@/lib/i18n";

type Incident = "money" | "account" | "message";
export function EmergencyGuide({ messages }: { messages: Messages }) {
  const tr = translator(messages);
  const [incident, setIncident] = useState<Incident>("money");
  const [done, setDone] = useState<string[]>([]);
  const steps = [incident, "secure", "evidence", "report", "watch"];
  return <div className="ex-emergency">
    <p className="ex-eyebrow">{tr("experience.emergency")}</p><h1>{tr("experience.emergencyTitle")}</h1><p>{tr("experience.emergencyBody")}</p>
    <fieldset><legend>{tr("experience.emergencyQuestion")}</legend><div className="ex-incident-options">{(["money", "account", "message"] as const).map((key) => <label key={key} data-selected={incident === key}><input type="radio" name="incident" value={key} checked={incident === key} onChange={() => { setIncident(key); setDone([]); }}/>{tr(`experience.emergency${key === "money" ? "Money" : key === "account" ? "Account" : "Message"}`)}</label>)}</div></fieldset>
    <div className="ex-emergency-progress" role="status">{tr("experience.emergencyProgress", { done: done.length })}<progress max={5} value={done.length}/></div>
    <ol className="ex-emergency-steps">{steps.map((step, index) => <li key={step} data-done={done.includes(step)}><span className="ex-step-number" aria-hidden="true">{done.includes(step) ? "✓" : `0${index + 1}`}</span><div><h2>{tr(`experience.emergencySteps.${step}Title`)}</h2><p>{tr(`experience.emergencySteps.${step}Body`)}</p>{step === "watch" && <Link className="ex-text-link" href="/cuenta">{tr("nav.account")} ↗</Link>}<button className="ex-button-secondary" aria-pressed={done.includes(step)} onClick={() => setDone((current) => current.includes(step) ? current.filter((s) => s !== step) : [...current, step])}>{tr(done.includes(step) ? "experience.emergencyUndo" : "experience.emergencyDone")}</button></div></li>)}</ol>
    <section className="ex-panel"><a className="ex-button" href="tel:017">{tr("experience.emergencyHelp")}</a><p className="ex-note mt-3">{tr("experience.emergencyHelpNote")}</p><a className="ex-text-link" href="https://www.incibe.es/ciudadania/ayuda/reporte-de-fraude" target="_blank" rel="noopener noreferrer">{tr("experience.emergencySource")} ↗</a></section>
    <p className="ex-note">{tr("experience.emergencyLocal")}</p><button className="ex-quiet" onClick={() => setDone([])}>{tr("experience.emergencyReset")}</button>
  </div>;
}
