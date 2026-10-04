import { supabaseAdmin } from "@/lib/supabase";
import { isPro } from "@/lib/plan";
import { isAdminEmail } from "@/lib/domain-report";
import type { UserRow } from "@/lib/users";
import { defaultWorkspace, sanitizeWorkspace, type LabWorkspace } from "@/lib/lab-core";

export * from "@/lib/lab-core";

/** Rastro Lab es para cuentas Pro y administradores. */
export function canUseLab(user: UserRow | null): boolean {
  return Boolean(user) && (isPro(user) || isAdminEmail(user!.email));
}

export async function loadWorkspace(userId: string, locale: "es" | "en"): Promise<{ workspace: LabWorkspace; updatedAt: string | null }> {
  const { data } = await supabaseAdmin().from("lab_workspaces").select("data, updated_at").eq("user_id", userId).maybeSingle<{ data: unknown; updated_at: string }>();
  if (!data) return { workspace: defaultWorkspace(locale), updatedAt: null };
  return { workspace: sanitizeWorkspace(data.data, locale) ?? defaultWorkspace(locale), updatedAt: data.updated_at };
}

/** Guarda el cuaderno saneado. Devuelve la nueva marca de tiempo. */
export async function saveWorkspace(userId: string, ws: LabWorkspace, locale: "es" | "en"): Promise<string | null> {
  const clean = sanitizeWorkspace(ws, locale);
  if (!clean) return null;
  const updatedAt = new Date().toISOString();
  const { error } = await supabaseAdmin().from("lab_workspaces").upsert({ user_id: userId, data: clean, updated_at: updatedAt }, { onConflict: "user_id" });
  return error ? null : updatedAt;
}

import { getMessages, translator, type Locale } from "@/lib/i18n";
import {
  CVE_STATES, FAMILIES, FINDING_STATES, HYPOTHESIS_STATES, SEVERITIES, LIMITS,
  newProject, type CveState, type Family, type FindingState, type HypothesisState,
  type LabProject, type ReportLabels, type Severity,
} from "@/lib/lab-core";

/** Etiquetas del informe en el idioma pedido, desde messages (para API y MCP, sin navegador). */
export function reportLabels(locale: Locale): ReportLabels {
  const tr = translator(getMessages(locale));
  const map = <T extends string>(keys: readonly T[], base: string) => Object.fromEntries(keys.map((k) => [k, tr(`${base}.${k}`)])) as Record<T, string>;
  return {
    target: tr("lab.report.target"), host: tr("lab.report.host"), scope: tr("lab.report.scope"), started: tr("lab.report.started"),
    findings: tr("lab.find.title"), none: tr("lab.report.none"), severity: tr("lab.find.severity"), family: tr("lab.find.family"), where: tr("lab.find.where"), status: tr("lab.find.status"),
    hypotheses: tr("lab.hyp.title"), steps: tr("lab.steps.title"), tools: tr("lab.tools.title"), cves: tr("lab.cve.title"), cveSoftware: tr("lab.cve.software"), services: tr("lab.svc.title"),
    families: map(FAMILIES, "lab.find.families"), severities: map(SEVERITIES, "lab.find.severities"), states: map(FINDING_STATES, "lab.find.states"),
    hypothesisStates: map(HYPOTHESIS_STATES, "lab.hyp.states"), cveStates: map(CVE_STATES, "lab.cve.states"),
  };
}

/** Resumen de un trabajo para listados (sin volcar todo el contenido). */
export function jobSummary(id: string, p: LabProject) {
  return { id, name: p.name, host: p.target.host, authorized: p.target.authorized, steps_done: p.steps.filter((s) => s.ok).length, steps_total: p.steps.length, findings: p.findings.length, cves: p.cves.length, services: p.services.length, logs: p.logs.length, hypotheses: p.hypotheses.length };
}

const SEV = (v: unknown): Severity => (SEVERITIES.includes(v as Severity) ? (v as Severity) : "medium");

/** Mutaciones del cuaderno usadas por la API/MCP. Devuelven el id del trabajo afectado o null si no existe. */
export function labAddFinding(ws: LabWorkspace, jobId: string, f: { title?: string; where?: string; family?: string; severity?: string; status?: string; notes?: string }): boolean {
  const p = ws.projects[jobId]; if (!p || !f.title) return false;
  if (p.findings.length >= LIMITS.findings) return false;
  p.findings.unshift({ title: String(f.title), where: String(f.where ?? ""), family: (FAMILIES.includes(f.family as Family) ? f.family : "other") as Family, severity: SEV(f.severity), status: (FINDING_STATES.includes(f.status as FindingState) ? f.status : "draft") as FindingState, notes: String(f.notes ?? ""), at: new Date().toISOString() });
  return true;
}
export function labAddCve(ws: LabWorkspace, jobId: string, c: { id?: string; software?: string; version?: string; severity?: string; state?: string; notes?: string; ref?: string }): boolean {
  const p = ws.projects[jobId]; if (!p || (!c.id && !c.software)) return false;
  if (p.cves.length >= LIMITS.cves) return false;
  p.cves.unshift({ id: String(c.id ?? ""), software: String(c.software ?? ""), version: String(c.version ?? ""), severity: SEV(c.severity), state: (CVE_STATES.includes(c.state as CveState) ? c.state : "investigating") as CveState, notes: String(c.notes ?? ""), ref: String(c.ref ?? "") });
  return true;
}
export function labAddHypothesis(ws: LabWorkspace, jobId: string, txt: string, state?: string): boolean {
  const p = ws.projects[jobId]; if (!p || !txt.trim()) return false;
  if (p.hypotheses.length >= LIMITS.hypotheses) return false;
  p.hypotheses.push({ txt, state: (HYPOTHESIS_STATES.includes(state as HypothesisState) ? state : "open") as HypothesisState });
  return true;
}
export function labSetTarget(ws: LabWorkspace, jobId: string, t: { name?: string; host?: string; scope?: string; started?: string; authorized?: boolean }): boolean {
  const p = ws.projects[jobId]; if (!p) return false;
  if (t.name !== undefined) p.target.name = String(t.name).slice(0, 160);
  if (t.host !== undefined) p.target.host = String(t.host).slice(0, 255);
  if (t.scope !== undefined) p.target.scope = String(t.scope).slice(0, 2000);
  if (t.started !== undefined) p.target.started = String(t.started).slice(0, 40);
  if (t.authorized !== undefined) p.target.authorized = Boolean(t.authorized);
  return true;
}
export function labAddService(ws: LabWorkspace, jobId: string, sv: { port?: number | string; proto?: string; name?: string; version?: string; notes?: string }): boolean {
  const p = ws.projects[jobId]; if (!p) return false;
  const port = Number(sv.port);
  if (!(Number.isInteger(port) && port > 0 && port < 65536) && !sv.name) return false;
  if (p.services.length >= LIMITS.services) return false;
  const proto = sv.proto === "udp" ? "udp" : "tcp";
  const i = p.services.findIndex((x) => x.port === port && x.proto === proto && port > 0);
  const entry = { port: Number.isInteger(port) && port > 0 ? port : 0, proto, name: String(sv.name ?? "").slice(0, 80), version: String(sv.version ?? "").slice(0, 160), notes: String(sv.notes ?? "").slice(0, 2000) } as const;
  if (i >= 0) p.services[i] = { ...entry }; else p.services.push({ ...entry });
  return true;
}
export function labAddLog(ws: LabWorkspace, jobId: string, l: { tool?: string; cmd?: string; output?: string }): boolean {
  const p = ws.projects[jobId]; if (!p) return false;
  if (!l.cmd && !l.output) return false;
  p.logs.push({ at: new Date().toISOString(), tool: String(l.tool ?? "").slice(0, 40), cmd: String(l.cmd ?? "").slice(0, 500), output: String(l.output ?? "").slice(0, LIMITS.logBytes) });
  if (p.logs.length > LIMITS.logs) p.logs = p.logs.slice(-LIMITS.logs);
  return true;
}
export function labSetStep(ws: LabWorkspace, jobId: string, opts: { text?: string; index?: number; done?: boolean }): boolean {
  const p = ws.projects[jobId]; if (!p) return false;
  if (typeof opts.index === "number" && p.steps[opts.index]) { if (opts.done !== undefined) p.steps[opts.index].ok = Boolean(opts.done); return true; }
  if (opts.text) {
    const i = p.steps.findIndex((s) => s.t.toLowerCase() === opts.text!.toLowerCase());
    if (i >= 0) { if (opts.done !== undefined) p.steps[i].ok = Boolean(opts.done); return true; }
    if (p.steps.length >= LIMITS.steps) return false;
    p.steps.push({ t: opts.text.slice(0, 200), ok: Boolean(opts.done) }); return true;
  }
  return false;
}

export function labCreateJob(ws: LabWorkspace, locale: Locale, name: string, host?: string, scope?: string): string | null {
  if (Object.keys(ws.projects).length >= LIMITS.projects) return null;
  const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const p = newProject(name, locale === "en" ? "en" : "es");
  if (host) p.target.host = String(host).slice(0, 255);
  if (scope) p.target.scope = String(scope).slice(0, 2000);
  ws.projects[id] = p; ws.active = id;
  return id;
}
