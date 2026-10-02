"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { translator, type Locale, type Messages } from "@/lib/i18n";
import {
  CHEAT_TOOLS, CVE_STATES, FAMILIES, FINDING_STATES, HYPOTHESIS_STATES, SEVERITIES,
  cheatSheet, cveRef, isLegacy, newProject, normalizeCveId, progressOf, toMarkdown,
  type CheatTool, type CveState, type Family, type FindingState, type HypothesisState, type LabCve, type LabProject, type LabWorkspace as Workspace, type ReportLabels, type Severity,
} from "@/lib/lab-core";

/**
 * Rastro Lab: cuaderno de laboratorios y bug bounty. Todo el estado vive en un
 * solo objeto (como la app local de la que viene) y se guarda solo, con un
 * pequeño retardo, en la cuenta. La pagina no ejecuta nada: los comandos se
 * copian al portapapeles y se pegan en la terminal de cada uno.
 */
const SEVERITY_TONE: Record<Severity, string> = { critical: "tone-bad", high: "tone-bad", medium: "tone-warn", low: "tone-ok", info: "" };
const STATE_TONE: Record<HypothesisState, string> = { open: "text-ink", confirmed: "text-accent", discarded: "text-faint line-through" };
const CARD = "card card-pad min-w-0";
const LABEL = "mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-faint";

type SaveState = "idle" | "saving" | "saved" | "error" | "conflict" | "tooBig";

export function LabWorkspace({ initial, initialUpdatedAt, messages, locale }: { initial: Workspace; initialUpdatedAt: string | null; messages: Messages; locale: Locale }) {
  const tr = useMemo(() => translator(messages), [messages]);
  const [ws, setWs] = useState<Workspace>(initial);
  const [save, setSave] = useState<SaveState>("idle");
  const [cheat, setCheat] = useState<CheatTool | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const base = useRef<string | null>(initialUpdatedAt);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Workspace>(initial);
  const dirty = useRef(false);
  const pushRef = useRef<() => void>(() => {});

  const push = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSave("saving");
    try {
      const res = await fetch("/api/lab", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspace: latest.current, base: base.current }) });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; updatedAt?: string };
      if (res.status === 409) return setSave("conflict");
      if (res.status === 413) return setSave("tooBig");
      if (!res.ok || !body.ok) throw new Error(String(res.status));
      base.current = body.updatedAt ?? base.current;
      setSave(dirty.current ? "saving" : "saved");
    } catch {
      dirty.current = true;
      setSave("error");
      timer.current = setTimeout(() => pushRef.current(), 4000);
    }
  }, []);
  useEffect(() => { pushRef.current = push; }, [push]);

  /** Cambia el estado y programa el guardado (un solo PUT tras 600 ms sin teclear). */
  const update = useCallback((fn: (draft: Workspace) => void) => {
    setWs((prev) => {
      const next = structuredClone(prev);
      fn(next);
      latest.current = next;
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => pushRef.current(), 600);
      return next;
    });
  }, []);

  // Al cerrar la pestaña con cambios sin guardar, se intenta un ultimo guardado.
  useEffect(() => {
    const flush = () => { if (dirty.current) navigator.sendBeacon?.("/api/lab/beacon", new Blob([JSON.stringify({ workspace: latest.current, base: base.current })], { type: "application/json" })); };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); if (timer.current) clearTimeout(timer.current); };
  }, []);

  const p: LabProject = ws.projects[ws.active] ?? Object.values(ws.projects)[0];
  const project = (fn: (pr: LabProject) => void) => update((d) => fn(d.projects[d.active]));
  const prog = progressOf(p);
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const createdLabel = (() => { const d = new Date(p.created); return Number.isNaN(d.getTime()) ? p.created : dateFmt.format(d); })();

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied((k) => (k === key ? null : k)), 1200); } catch { /* sin permiso de portapapeles */ }
  }

  function addProject() {
    const name = window.prompt(tr("lab.newPrompt"), `${tr("lab.job")} ${Object.keys(ws.projects).length + 1}`);
    if (name === null) return;
    const id = "p" + Date.now().toString(36);
    update((d) => { d.projects[id] = newProject(name, locale); d.active = id; });
  }
  function renameProject() {
    const name = window.prompt(tr("lab.newPrompt"), p.name);
    if (name) project((pr) => { pr.name = name.slice(0, 120); });
  }
  function deleteProject() {
    if (Object.keys(ws.projects).length <= 1) return window.alert(tr("lab.deleteLast"));
    if (!window.confirm(tr("lab.deleteConfirm", { name: p.name }))) return;
    update((d) => { delete d.projects[d.active]; d.active = Object.keys(d.projects)[0]; });
  }

  const labels: ReportLabels = {
    target: tr("lab.report.target"), host: tr("lab.report.host"), scope: tr("lab.report.scope"), started: tr("lab.report.started"),
    findings: tr("lab.find.title"), none: tr("lab.report.none"), severity: tr("lab.find.severity"), family: tr("lab.find.family"), where: tr("lab.find.where"), status: tr("lab.find.status"),
    hypotheses: tr("lab.hyp.title"), steps: tr("lab.steps.title"), tools: tr("lab.tools.title"), cves: tr("lab.cve.title"), cveSoftware: tr("lab.cve.software"),
    families: Object.fromEntries(FAMILIES.map((f) => [f, tr(`lab.find.families.${f}`)])) as Record<Family, string>,
    severities: Object.fromEntries(SEVERITIES.map((s) => [s, tr(`lab.find.severities.${s}`)])) as Record<Severity, string>,
    states: Object.fromEntries(FINDING_STATES.map((s) => [s, tr(`lab.find.states.${s}`)])) as Record<FindingState, string>,
    hypothesisStates: Object.fromEntries(HYPOTHESIS_STATES.map((s) => [s, tr(`lab.hyp.states.${s}`)])) as Record<HypothesisState, string>,
    cveStates: Object.fromEntries(CVE_STATES.map((s) => [s, tr(`lab.cve.states.${s}`)])) as Record<CveState, string>,
  };

  async function importFile(file: File) {
    setNotice(null);
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { return setNotice(tr("lab.import.bad")); }
    if (!isLegacy(parsed)) return setNotice(tr("lab.import.bad"));
    if (!window.confirm(tr("lab.import.confirm"))) return;
    const res = await fetch("/api/lab", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspace: parsed, import: true }) });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; updatedAt?: string; workspace?: Workspace };
    if (!res.ok || !body.ok || !body.workspace) return setNotice(tr(res.status === 413 ? "lab.errors.tooBig" : "lab.import.bad"));
    base.current = body.updatedAt ?? null;
    latest.current = body.workspace;
    dirty.current = false;
    setWs(body.workspace);
    setSave("saved");
    setNotice(tr("lab.import.done"));
  }

  const saveText = save === "saving" ? tr("lab.saving") : save === "saved" ? tr("lab.saved") : save === "error" ? tr("lab.saveError") : save === "conflict" ? tr("lab.errors.conflict") : save === "tooBig" ? tr("lab.errors.tooBig") : "";

  return (
    <div className="grid gap-4">
      {/* Trabajo activo */}
      <section className={CARD + " card-accent"}>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="lab-job" className="text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">{tr("lab.job")}</label>
          <select id="lab-job" className="field min-w-0 flex-1 !py-2.5 sm:max-w-[320px]" value={ws.active} onChange={(e) => update((d) => { d.active = e.target.value; })}>
            {Object.entries(ws.projects).map(([id, pr]) => <option key={id} value={id}>{pr.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={addProject}>+ {tr("lab.new")}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={renameProject}>{tr("lab.rename")}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={deleteProject}>{tr("lab.delete")}</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-faint">{tr("lab.created", { date: createdLabel })} · {tr("lab.progress", { done: prog.done, total: prog.total })}</p>
          <p className={"text-[12.5px] font-medium " + (save === "error" || save === "conflict" || save === "tooBig" ? "text-warn" : "text-faint")} aria-live="polite">
            {saveText}
            {save === "conflict" && <button type="button" className="ml-2 underline underline-offset-4" onClick={() => location.reload()}>{tr("lab.reload")}</button>}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${prog.percent}%` }} /></div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Objetivo */}
        <section className={CARD}>
          <h2 className="h3 text-ink">{tr("lab.target.title")}</h2>
          <div className="mt-4 grid gap-3">
            <div><label className={LABEL} htmlFor="lab-t-name">{tr("lab.target.name")}</label><input id="lab-t-name" className="field" value={p.target.name} onChange={(e) => project((pr) => { pr.target.name = e.target.value; })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LABEL} htmlFor="lab-t-host">{tr("lab.target.host")}</label><input id="lab-t-host" className="field" value={p.target.host} autoCapitalize="none" spellCheck={false} onChange={(e) => project((pr) => { pr.target.host = e.target.value; })} /></div>
              <div><label className={LABEL} htmlFor="lab-t-start">{tr("lab.target.started")}</label><input id="lab-t-start" className="field" value={p.target.started} placeholder="dd/mm hh:mm" onChange={(e) => project((pr) => { pr.target.started = e.target.value; })} /></div>
            </div>
            <div><label className={LABEL} htmlFor="lab-t-scope">{tr("lab.target.scope")}</label><textarea id="lab-t-scope" className="field min-h-[76px]" value={p.target.scope} placeholder={tr("lab.target.scopeHint")} onChange={(e) => project((pr) => { pr.target.scope = e.target.value; })} /></div>
            <label className="flex items-start gap-3 text-[14px] text-ink"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#4dfc5f]" checked={p.target.authorized} onChange={(e) => project((pr) => { pr.target.authorized = e.target.checked; })} />{tr("lab.target.authorized")}</label>
            {!p.target.authorized && <p className="rounded-[12px] bg-warn/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-warn">{tr("lab.target.warn")}</p>}
          </div>
        </section>

        {/* Hipotesis */}
        <section className={CARD}>
          <h2 className="h3 text-ink">{tr("lab.hyp.title")}</h2>
          <p className="note mt-1">{tr("lab.hyp.hint")}</p>
          <ul className="mt-4 grid gap-2">
            {p.hypotheses.length === 0 && <li className="text-[13.5px] text-muted">{tr("lab.hyp.empty")}</li>}
            {p.hypotheses.map((h, i) => (
              <li key={i} className={"flex gap-3 rounded-[14px] border px-3.5 py-3 " + (i === 0 ? "border-accent/40 bg-accent-soft" : "border-line bg-surface-2")}>
                <span className={"num mt-0.5 shrink-0 text-[15px] " + (i === 0 ? "text-accent" : "text-faint")}>#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={"whitespace-pre-wrap break-words text-[14px] leading-relaxed " + STATE_TONE[h.state]}>{h.txt}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {i > 0 && <button type="button" className="btn btn-ghost btn-sm !min-h-[34px] !px-2.5" onClick={() => project((pr) => { const [x] = pr.hypotheses.splice(i, 1); pr.hypotheses.splice(i - 1, 0, x); })}>↑ {tr("lab.hyp.up")}</button>}
                    <select className="field !w-auto !py-1.5 text-[13px]" value={h.state} aria-label={tr("lab.find.status")} onChange={(e) => project((pr) => { pr.hypotheses[i].state = e.target.value as HypothesisState; })}>
                      {HYPOTHESIS_STATES.map((s) => <option key={s} value={s}>{tr(`lab.hyp.states.${s}`)}</option>)}
                    </select>
                    <button type="button" className="btn btn-ghost btn-sm !min-h-[34px] !px-2.5" onClick={() => project((pr) => { pr.hypotheses.splice(i, 1); })}>{tr("lab.hyp.remove")}</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <AddLine placeholder={tr("lab.hyp.placeholder")} cta={tr("lab.hyp.add")} multiline onAdd={(v) => project((pr) => { pr.hypotheses.push({ txt: v, state: "open" }); })} />
        </section>

        {/* Pasos */}
        <section className={CARD}>
          <h2 className="h3 text-ink">{tr("lab.steps.title")}</h2>
          <ul className="mt-4 grid gap-1.5">
            {p.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-3 rounded-[12px] px-1 py-1.5">
                <input id={`lab-s-${i}`} type="checkbox" className="h-5 w-5 shrink-0 accent-[#4dfc5f]" checked={s.ok} onChange={(e) => project((pr) => { pr.steps[i].ok = e.target.checked; })} />
                <label htmlFor={`lab-s-${i}`} className={"min-w-0 flex-1 text-[14.5px] " + (s.ok ? "text-faint line-through" : "text-ink")}>{s.t}</label>
                <button type="button" aria-label={tr("lab.hyp.remove")} className="shrink-0 px-2 text-[16px] text-faint hover:text-ink" onClick={() => project((pr) => { pr.steps.splice(i, 1); })}>×</button>
              </li>
            ))}
          </ul>
          <AddLine placeholder={tr("lab.steps.placeholder")} cta={tr("lab.steps.add")} onAdd={(v) => project((pr) => { pr.steps.push({ t: v, ok: false }); })} />
        </section>

        {/* Herramientas + chuleta */}
        <section className={CARD}>
          <h2 className="h3 text-ink">{tr("lab.tools.title")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.tools.map((t, i) => (
              <span key={t} className="chip">{t}<button type="button" aria-label={tr("lab.hyp.remove")} className="ml-1.5 text-faint hover:text-ink" onClick={() => project((pr) => { pr.tools.splice(i, 1); })}>×</button></span>
            ))}
          </div>
          <AddLine placeholder={tr("lab.tools.placeholder")} cta={tr("lab.tools.add")} onAdd={(v) => project((pr) => { if (!pr.tools.includes(v)) pr.tools.push(v.slice(0, 60)); })} />
          <h3 className="mt-6 text-[14px] font-semibold text-ink">{tr("lab.cheat.title")}</h3>
          <p className="note mt-1">{tr("lab.cheat.hint")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CHEAT_TOOLS.map((t) => <button key={t} type="button" className="btn btn-secondary btn-sm font-mono" onClick={() => setCheat(t)}>{t}</button>)}
          </div>
        </section>

        {/* Diccionarios */}
        <section className={CARD}>
          <h2 className="h3 text-ink">{tr("lab.words.title")}</h2>
          <p className="note mt-1">{tr("lab.words.hint")}</p>
          <ul className="mt-3 grid gap-2">
            {ws.wordlists.map((d, i) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="chip shrink-0">{d.cat}</span>
                <input className="field min-w-0 flex-1 !py-2 font-mono text-[12.5px]" value={d.path} spellCheck={false} aria-label={d.cat} onChange={(e) => update((w) => { w.wordlists[i].path = e.target.value; })} />
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => copy(d.path, `w${i}`)}>{copied === `w${i}` ? "✓" : tr("lab.words.copy")}</button>
                <button type="button" aria-label={tr("lab.hyp.remove")} className="shrink-0 px-1.5 text-[16px] text-faint hover:text-ink" onClick={() => update((w) => { w.wordlists.splice(i, 1); })}>×</button>
              </li>
            ))}
          </ul>
          <AddPair a={tr("lab.words.cat")} b={tr("lab.words.path")} cta={tr("lab.words.add")} onAdd={(cat, path) => update((w) => { w.wordlists.push({ id: "d" + Date.now().toString(36), cat, path }); })} />
        </section>

        {/* Accesos rapidos */}
        <section className={CARD}>
          <h2 className="h3 text-ink">{tr("lab.servers.title")}</h2>
          <p className="note mt-1">{tr("lab.servers.hint")}</p>
          <ul className="mt-3 grid gap-2">
            {ws.servers.length === 0 && <li className="text-[13.5px] text-muted">{tr("lab.servers.empty")}</li>}
            {ws.servers.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-[12px] bg-surface-2 px-3.5 py-2.5">
                <span className="min-w-0"><span className="block truncate text-[14px] font-semibold text-ink">{s.name}</span><span className="block truncate font-mono text-[12px] text-faint">{s.cmd}</span></span>
                <span className="flex shrink-0 items-center gap-1">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => copy(s.cmd, `s${i}`)}>{copied === `s${i}` ? "✓" : tr("lab.servers.copy")}</button>
                  <button type="button" aria-label={tr("lab.hyp.remove")} className="px-1.5 text-[16px] text-faint hover:text-ink" onClick={() => update((w) => { w.servers.splice(i, 1); })}>×</button>
                </span>
              </li>
            ))}
          </ul>
          <AddPair a={tr("lab.servers.name")} b={tr("lab.servers.cmd")} cta={tr("lab.servers.add")} onAdd={(name, cmd) => update((w) => { w.servers.push({ name, cmd }); })} />
        </section>
      </div>

      {/* CVE / vulnerabilidades conocidas */}
      <section className={CARD}>
        <h2 className="h3 text-ink">{tr("lab.cve.title")}</h2>
        <p className="note mt-1">{tr("lab.cve.hint")}</p>
        <ul className="mt-4 grid gap-2">
          {p.cves.length === 0 && <li className="text-[13.5px] text-muted">{tr("lab.cve.empty")}</li>}
          {p.cves.map((c, i) => {
            const ref = cveRef(c);
            return (
              <li key={i} className="rounded-[14px] border border-line bg-surface-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[14.5px] font-semibold text-ink">{c.id || "—"}{c.software && <span className="ml-2 font-sans text-muted">{c.software}{c.version ? ` ${c.version}` : ""}</span>}</p>
                  </div>
                  <span className={"badge shrink-0 " + SEVERITY_TONE[c.severity]}>{tr(`lab.find.severities.${c.severity}`)}</span>
                </div>
                {c.notes && <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-muted">{c.notes}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select className="field !w-auto !py-1.5 text-[13px]" value={c.state} aria-label={tr("lab.find.status")} onChange={(e) => project((pr) => { pr.cves[i].state = e.target.value as CveState; })}>
                    {CVE_STATES.map((st) => <option key={st} value={st}>{tr(`lab.cve.states.${st}`)}</option>)}
                  </select>
                  {ref && <a href={ref} target="_blank" rel="noreferrer nofollow" className="link text-[13px]">{tr("lab.cve.advisory")} ↗</a>}
                  {c.id && <button type="button" className="btn btn-ghost btn-sm !min-h-[34px] !px-2.5" onClick={() => copy(c.id, `cve-${i}`)}>{copied === `cve-${i}` ? "✓" : tr("lab.cve.copyId")}</button>}
                  <button type="button" className="btn btn-ghost btn-sm !min-h-[34px] !px-2.5" onClick={() => project((pr) => { pr.cves.splice(i, 1); })}>{tr("lab.cve.remove")}</button>
                </div>
              </li>
            );
          })}
        </ul>
        <CveForm tr={tr} onAdd={(c) => project((pr) => { pr.cves.unshift(c); })} />
      </section>

      {/* Hallazgos */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="h3 text-ink">{tr("lab.find.title")} <span className="ml-1 text-faint">{p.findings.length}</span></h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(toMarkdown(p, labels), "md")}>{copied === "md" ? tr("lab.report.copied") : tr("lab.report.copy")}</button>
        </div>
        <FindingForm tr={tr} onAdd={(f) => project((pr) => { pr.findings.unshift({ ...f, at: new Date().toISOString() }); })} />
        <ul className="mt-5 grid gap-3">
          {p.findings.length === 0 && <li className="text-[13.5px] text-muted">{tr("lab.find.empty")}</li>}
          {p.findings.map((f, i) => (
            <li key={i} className="rounded-[14px] border border-line bg-surface-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 break-words text-[15px] font-semibold text-ink">{f.title}</p>
                <span className="flex shrink-0 flex-wrap gap-1.5">
                  <span className={"badge " + SEVERITY_TONE[f.severity]}>{tr(`lab.find.severities.${f.severity}`)}</span>
                  <span className="badge">{tr(`lab.find.families.${f.family}`)}</span>
                </span>
              </div>
              {f.where && <p className="mt-1 break-all font-mono text-[12.5px] text-muted">{f.where}</p>}
              {f.notes && <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-muted">{f.notes}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select className="field !w-auto !py-1.5 text-[13px]" value={f.status} aria-label={tr("lab.find.status")} onChange={(e) => project((pr) => { pr.findings[i].status = e.target.value as FindingState; })}>
                  {FINDING_STATES.map((s) => <option key={s} value={s}>{tr(`lab.find.states.${s}`)}</option>)}
                </select>
                <button type="button" className="btn btn-ghost btn-sm !min-h-[34px] !px-2.5" onClick={() => project((pr) => { pr.findings.splice(i, 1); })}>{tr("lab.find.remove")}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Importar + privacidad */}
      <section className={CARD}>
        <h2 className="h3 text-ink">{tr("lab.import.title")}</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{tr("lab.import.body")}</p>
        <p className="mt-1 font-mono text-[12px] text-faint">{tr("lab.import.path")}</p>
        <label className="btn btn-secondary btn-sm mt-3 cursor-pointer">
          {tr("lab.import.pick")}
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
        </label>
        {notice && <p className="mt-3 text-[13.5px] font-medium text-accent" aria-live="polite">{notice}</p>}
        <p className="note mt-4">{tr("lab.privacy")}</p>
      </section>

      {/* Chuleta */}
      {cheat && (
        <div role="dialog" aria-modal="true" aria-label={tr("lab.cheat.title")} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) setCheat(null); }}>
          <div className="card max-h-[86vh] w-full max-w-[640px] overflow-y-auto p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-mono text-[18px] font-semibold text-ink">{cheat}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCheat(null)}>{tr("lab.cheat.close")}</button>
            </div>
            <ul className="mt-4 grid gap-3">
              {cheatSheet(cheat, ws.wordlists, p.target.host).map(([key, cmd]) => (
                <li key={key}>
                  <p className="text-[13px] font-medium text-muted">{tr(`lab.cheat.labels.${key}`)}</p>
                  <button type="button" className="mt-1 block w-full rounded-[12px] border border-line bg-paper px-3.5 py-3 text-left font-mono text-[12.5px] leading-relaxed text-ink hover:border-accent" onClick={() => copy(cmd, `c-${key}`)}>
                    <span className="break-all">{cmd}</span>
                    {copied === `c-${key}` && <span className="ml-2 font-sans text-[12px] font-semibold text-accent">{tr("lab.cheat.copied")}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function AddLine({ placeholder, cta, onAdd, multiline = false }: { placeholder: string; cta: string; onAdd: (v: string) => void; multiline?: boolean }) {
  const [v, setV] = useState("");
  const add = () => { const t = v.trim(); if (!t) return; onAdd(t); setV(""); };
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      {multiline
        ? <textarea className="field min-h-[64px] flex-1" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} />
        : <input className="field flex-1" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />}
      <button type="button" className="btn btn-secondary btn-sm shrink-0 self-start sm:self-auto" onClick={add}>{cta}</button>
    </div>
  );
}

function AddPair({ a, b, cta, onAdd }: { a: string; b: string; cta: string; onAdd: (a: string, b: string) => void }) {
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const add = () => { if (!x.trim() || !y.trim()) return; onAdd(x.trim(), y.trim()); setX(""); setY(""); };
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <input className="field sm:w-[34%]" value={x} placeholder={a} onChange={(e) => setX(e.target.value)} />
      <input className="field flex-1 font-mono text-[13px]" value={y} placeholder={b} spellCheck={false} autoCapitalize="none" onChange={(e) => setY(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={add}>{cta}</button>
    </div>
  );
}

function FindingForm({ tr, onAdd }: { tr: (key: string, vars?: Record<string, string | number>) => string; onAdd: (f: { title: string; where: string; family: Family; severity: Severity; status: FindingState; notes: string }) => void }) {
  const [title, setTitle] = useState("");
  const [where, setWhere] = useState("");
  const [family, setFamily] = useState<Family>("access");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [notes, setNotes] = useState("");
  const add = () => { if (!title.trim()) return; onAdd({ title: title.trim(), where: where.trim(), family, severity, status: "draft", notes }); setTitle(""); setWhere(""); setNotes(""); };
  return (
    <div className="mt-4 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={LABEL} htmlFor="lab-f-title">{tr("lab.find.titleField")}</label><input id="lab-f-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className={LABEL} htmlFor="lab-f-where">{tr("lab.find.where")}</label><input id="lab-f-where" className="field font-mono text-[13px]" value={where} spellCheck={false} autoCapitalize="none" onChange={(e) => setWhere(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LABEL} htmlFor="lab-f-fam">{tr("lab.find.family")}</label><select id="lab-f-fam" className="field" value={family} onChange={(e) => setFamily(e.target.value as Family)}>{FAMILIES.map((f) => <option key={f} value={f}>{tr(`lab.find.families.${f}`)}</option>)}</select></div>
        <div><label className={LABEL} htmlFor="lab-f-sev">{tr("lab.find.severity")}</label><select id="lab-f-sev" className="field" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>{SEVERITIES.map((s) => <option key={s} value={s}>{tr(`lab.find.severities.${s}`)}</option>)}</select></div>
      </div>
      <div><label className={LABEL} htmlFor="lab-f-notes">{tr("lab.find.notes")}</label><textarea id="lab-f-notes" className="field min-h-[96px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <button type="button" className="btn btn-primary self-start" onClick={add}>{tr("lab.find.save")}</button>
    </div>
  );
}

function CveForm({ tr, onAdd }: { tr: (key: string, vars?: Record<string, string | number>) => string; onAdd: (c: LabCve) => void }) {
  const [id, setId] = useState("");
  const [software, setSoftware] = useState("");
  const [version, setVersion] = useState("");
  const [severity, setSeverity] = useState<Severity>("high");
  const [notes, setNotes] = useState("");
  const [ref, setRef] = useState("");
  const add = () => {
    const nid = normalizeCveId(id);
    if (!nid && !software.trim()) return;
    onAdd({ id: nid, software: software.trim(), version: version.trim(), severity, state: "investigating", notes, ref: ref.trim() });
    setId(""); setSoftware(""); setVersion(""); setNotes(""); setRef("");
  };
  return (
    <div className="mt-4 grid gap-3 border-t border-line pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={LABEL} htmlFor="lab-cve-id">{tr("lab.cve.id")}</label><input id="lab-cve-id" className="field font-mono text-[13px]" value={id} placeholder={tr("lab.cve.idPlaceholder")} autoCapitalize="characters" spellCheck={false} onChange={(e) => setId(e.target.value)} /></div>
        <div><label className={LABEL} htmlFor="lab-cve-sw">{tr("lab.cve.software")}</label><input id="lab-cve-sw" className="field" value={software} placeholder={tr("lab.cve.softwarePlaceholder")} onChange={(e) => setSoftware(e.target.value)} /></div>
        <div><label className={LABEL} htmlFor="lab-cve-ver">{tr("lab.cve.version")}</label><input id="lab-cve-ver" className="field" value={version} onChange={(e) => setVersion(e.target.value)} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={LABEL} htmlFor="lab-cve-sev">{tr("lab.find.severity")}</label><select id="lab-cve-sev" className="field" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>{SEVERITIES.map((sv) => <option key={sv} value={sv}>{tr(`lab.find.severities.${sv}`)}</option>)}</select></div>
        <div><label className={LABEL} htmlFor="lab-cve-ref">{tr("lab.cve.ref")}</label><input id="lab-cve-ref" className="field font-mono text-[12.5px]" value={ref} placeholder="https://…" spellCheck={false} onChange={(e) => setRef(e.target.value)} /></div>
      </div>
      <div><label className={LABEL} htmlFor="lab-cve-notes">{tr("lab.cve.notes")}</label><textarea id="lab-cve-notes" className="field min-h-[76px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <button type="button" className="btn btn-primary self-start" onClick={add}>{tr("lab.cve.add")}</button>
    </div>
  );
}
