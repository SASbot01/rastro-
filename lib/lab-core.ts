// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Rastro Lab: cuaderno para laboratorios y bug bounty. Un espacio de trabajo
 * por cuenta, con trabajos (un objetivo cada uno), pasos, hipotesis con
 * prioridad, herramientas, hallazgos, diccionarios y accesos rapidos.
 *
 * Nace de la app local "Sistema Bug Bounty" (un datos.json en el Mac): este
 * modulo define el mismo modelo, lo limpia antes de guardarlo en el servidor
 * y sabe importar aquel formato.
 */

export const FAMILIES = ["access", "logic", "auth", "ssrf", "injection", "xss", "info", "config", "other"] as const;
export type Family = (typeof FAMILIES)[number];
export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const FINDING_STATES = ["draft", "reported", "accepted", "duplicate", "rejected"] as const;
export type FindingState = (typeof FINDING_STATES)[number];
export const HYPOTHESIS_STATES = ["open", "confirmed", "discarded"] as const;
export type HypothesisState = (typeof HYPOTHESIS_STATES)[number];
export const CVE_STATES = ["investigating", "vulnerable", "exploited", "patched", "not_applicable"] as const;
export type CveState = (typeof CVE_STATES)[number];

export interface LabStep { t: string; ok: boolean }
export interface LabHypothesis { txt: string; state: HypothesisState }
export interface LabFinding { title: string; where: string; family: Family; severity: Severity; status: FindingState; notes: string; at: string }
export interface LabTarget { name: string; host: string; scope: string; started: string; authorized: boolean }
export interface LabCve { id: string; software: string; version: string; severity: Severity; state: CveState; notes: string; ref: string }
export interface LabService { port: number; proto: "tcp" | "udp"; name: string; version: string; notes: string }
export interface LabLog { at: string; tool: string; cmd: string; output: string }
export interface LabProject { name: string; created: string; target: LabTarget; steps: LabStep[]; hypotheses: LabHypothesis[]; cves: LabCve[]; services: LabService[]; logs: LabLog[]; tools: string[]; findings: LabFinding[] }
export interface LabWordlist { id: string; cat: string; path: string }
export interface LabServer { name: string; cmd: string }
export interface LabWorkspace { v: 1; active: string; projects: Record<string, LabProject>; wordlists: LabWordlist[]; servers: LabServer[] }

export const LIMITS = { projects: 100, steps: 40, hypotheses: 60, cves: 80, services: 80, logs: 60, logBytes: 20_000, tools: 60, findings: 200, wordlists: 40, servers: 12, bytes: 4_000_000 } as const;

export const DEFAULT_STEPS: Record<"es" | "en", string[]> = {
  es: ["Escaneo de puertos y servicios", "Identificar tecnología web", "Enumerar vhosts / subdominios", "Directorios y ficheros (ffuf)", "Mapear la app por Burp", "Explotación", "Redactar el informe"],
  en: ["Port and service scan", "Identify web technology", "Enumerate vhosts / subdomains", "Directories and files (ffuf)", "Map the app with Burp", "Exploitation", "Write the report"],
};

const str = (v: unknown, max: number): string => (typeof v === "string" ? v : "").replace(/\u0000/g, "").slice(0, max);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** CVE-AAAA-NNNN (o solo el numero suelto). Mayusculas y guiones; vacio si no encaja. */
export function normalizeCveId(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = t.match(/^(?:CVE[-\s]?)?(\d{4})[-\s]?(\d{4,7})$/);
  return m ? `CVE-${m[1]}-${m[2]}` : (/^[A-Z0-9][A-Z0-9.\-]{0,39}$/.test(t) ? t : "");
}

/** Solo http(s). Cualquier otra cosa (javascript:, data:...) se descarta. */
export function cleanUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try { const u = new URL(t); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : ""; } catch { return ""; }
}

/** Enlace al aviso oficial: el que guardo el usuario, o la ficha del CVE en NVD. */
export function cveRef(c: { id: string; ref: string }): string {
  if (c.ref) return c.ref;
  return /^CVE-\d{4}-\d{4,7}$/.test(c.id) ? `https://nvd.nist.gov/vuln/detail/${c.id}` : "";
}

export function newProject(name: string, locale: "es" | "en", now = new Date()): LabProject {
  return {
    name: str(name, 120) || (locale === "es" ? "Trabajo" : "Job"),
    created: now.toISOString(),
    target: { name: "", host: "", scope: "", started: "", authorized: false },
    steps: DEFAULT_STEPS[locale].map((t) => ({ t, ok: false })),
    hypotheses: [],
    cves: [],
    services: [],
    logs: [],
    tools: [],
    findings: [],
  };
}

export function defaultWorkspace(locale: "es" | "en", now = new Date()): LabWorkspace {
  const id = "p" + now.getTime().toString(36);
  return {
    v: 1,
    active: id,
    projects: { [id]: newProject(locale === "es" ? "Trabajo 1" : "Job 1", locale, now) },
    wordlists: [
      { id: "sub", cat: locale === "es" ? "subdominios" : "subdomains", path: "~/wordlists/subdomains-top5000.txt" },
      { id: "dir", cat: locale === "es" ? "directorios" : "directories", path: "~/wordlists/directory-list-2.3-medium.txt" },
      { id: "ffuf", cat: "ffuf", path: "~/wordlists/raft-medium-directories.txt" },
    ],
    servers: [],
  };
}

function cleanProject(raw: unknown, locale: "es" | "en"): LabProject {
  const p = obj(raw);
  const t = obj(p.target);
  return {
    name: str(p.name, 120) || (locale === "es" ? "Trabajo" : "Job"),
    created: str(p.created, 40),
    target: { name: str(t.name, 160), host: str(t.host, 255), scope: str(t.scope, 2000), started: str(t.started, 40), authorized: t.authorized === true },
    steps: arr(p.steps).slice(0, LIMITS.steps).map((s) => ({ t: str(obj(s).t, 200), ok: obj(s).ok === true })).filter((s) => s.t),
    hypotheses: arr(p.hypotheses).slice(0, LIMITS.hypotheses).map((h) => ({ txt: str(obj(h).txt, 2000), state: oneOf(obj(h).state, HYPOTHESIS_STATES, "open") })).filter((h) => h.txt),
    cves: arr(p.cves).slice(0, LIMITS.cves).map((c) => {
      const o = obj(c);
      return { id: normalizeCveId(str(o.id, 40)), software: str(o.software, 120), version: str(o.version, 60), severity: oneOf(o.severity, SEVERITIES, "medium"), state: oneOf(o.state, CVE_STATES, "investigating"), notes: str(o.notes, 6000), ref: cleanUrl(str(o.ref, 500)) };
    }).filter((c) => c.id || c.software),
    services: arr(p.services).slice(0, LIMITS.services).map((sv) => {
      const o = obj(sv);
      const port = Number(o.port);
      return { port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 0, proto: oneOf(o.proto, ["tcp", "udp"] as const, "tcp"), name: str(o.name, 80), version: str(o.version, 160), notes: str(o.notes, 2000) };
    }).filter((sv) => sv.port > 0 || sv.name),
    logs: arr(p.logs).slice(-LIMITS.logs).map((l) => {
      const o = obj(l);
      return { at: str(o.at, 40), tool: str(o.tool, 40), cmd: str(o.cmd, 500), output: str(o.output, LIMITS.logBytes) };
    }).filter((l) => l.cmd || l.output),
    tools: [...new Set(arr(p.tools).map((x) => str(x, 60).trim()).filter(Boolean))].slice(0, LIMITS.tools),
    findings: arr(p.findings).slice(0, LIMITS.findings).map((f) => {
      const o = obj(f);
      return { title: str(o.title, 200), where: str(o.where, 500), family: oneOf(o.family, FAMILIES, "other"), severity: oneOf(o.severity, SEVERITIES, "medium"), status: oneOf(o.status, FINDING_STATES, "draft"), notes: str(o.notes, 8000), at: str(o.at, 40) };
    }).filter((f) => f.title),
  };
}

/**
 * Deja el espacio de trabajo en una forma segura y acotada: tipos correctos,
 * textos recortados, listas con tope. Lo que llega del navegador nunca se
 * guarda tal cual. Devuelve null si pasa del tamaño maximo.
 */
export function sanitizeWorkspace(raw: unknown, locale: "es" | "en"): LabWorkspace | null {
  const w = obj(raw);
  const projects: Record<string, LabProject> = {};
  for (const [id, p] of Object.entries(obj(w.projects)).slice(0, LIMITS.projects)) {
    if (/^[a-z0-9_-]{1,40}$/i.test(id)) projects[id] = cleanProject(p, locale);
  }
  if (Object.keys(projects).length === 0) return defaultWorkspace(locale);
  const active = typeof w.active === "string" && projects[w.active] ? w.active : Object.keys(projects)[0];
  const out: LabWorkspace = {
    v: 1,
    active,
    projects,
    wordlists: arr(w.wordlists).slice(0, LIMITS.wordlists).map((d, i) => ({ id: str(obj(d).id, 40) || `d${i}`, cat: str(obj(d).cat, 60), path: str(obj(d).path, 400) })).filter((d) => d.cat && d.path),
    servers: arr(w.servers).slice(0, LIMITS.servers).map((s) => ({ name: str(obj(s).name, 60), cmd: str(obj(s).cmd, 200) })).filter((s) => s.name && s.cmd),
  };
  return JSON.stringify(out).length > LIMITS.bytes ? null : out;
}

const LEGACY_FAMILY: Array<[RegExp, Family]> = [[/idor|acceso/i, "access"], [/l[oó]gica/i, "logic"], [/autentic/i, "auth"], [/ssrf/i, "ssrf"], [/inyec|sqli|sql/i, "injection"], [/xss/i, "xss"]];
const LEGACY_STATE: Record<string, HypothesisState> = { abierta: "open", confirmada: "confirmed", descartada: "discarded" };
const LEGACY_ACTION: Record<string, string> = { ssh_minipc: "ssh minipc", ssh_vps: "ssh bugbounty-vps" };

/** ¿Es el datos.json de la app local "Sistema Bug Bounty"? */
export function isLegacy(raw: unknown): boolean {
  const w = obj(raw);
  return "proyectos" in w || ("pasos" in w && "hallazgos" in w);
}

/** Convierte el datos.json de la app local al modelo de Rastro Lab. */
export function importLegacy(raw: unknown, locale: "es" | "en"): LabWorkspace | null {
  const w = obj(raw);
  // Formato mas antiguo: un solo estado sin "proyectos".
  const source = "proyectos" in w ? obj(w.proyectos) : { p1: w };
  const projects: Record<string, unknown> = {};
  for (const [id, pr] of Object.entries(source)) {
    const p = obj(pr);
    const o = obj(p.objetivo);
    projects[/^[a-z0-9_-]{1,40}$/i.test(id) ? id : "p" + Object.keys(projects).length] = {
      name: p.nombre ?? o.nombre,
      created: p.creado,
      target: { name: o.nombre, host: o.ip, scope: "", started: o.inicio, authorized: false },
      steps: arr(p.pasos),
      hypotheses: arr(p.hipotesis).map((h) => ({ txt: obj(h).txt, state: LEGACY_STATE[String(obj(h).estado ?? "abierta")] ?? "open" })),
      tools: arr(p.herramientas),
      findings: arr(p.hallazgos).map((h) => {
        const f = obj(h);
        const fam = LEGACY_FAMILY.find(([re]) => re.test(String(f.fam ?? "")))?.[1] ?? "other";
        return { title: f.tit, where: f.donde, family: fam, severity: "medium", status: "draft", notes: f.notas, at: "" };
      }),
    };
  }
  return sanitizeWorkspace({
    active: w.activo,
    projects,
    wordlists: arr(w.diccionarios).map((d) => ({ id: obj(d).id, cat: obj(d).cat, path: obj(d).ruta })),
    servers: arr(w.servidores).map((s) => ({ name: obj(s).nombre, cmd: LEGACY_ACTION[String(obj(s).accion ?? "")] ?? "" })),
  }, locale);
}

/** Solo caracteres de un host o una IP: lo que se mete en un comando para copiar no puede traer nada mas. */
export function safeHost(host: string): string {
  const h = host.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  return /^[a-z0-9.:_-]{1,255}$/i.test(h) ? h : "";
}

export const CHEAT_TOOLS = ["nmap", "ffuf", "gobuster", "dirb"] as const;
export type CheatTool = (typeof CHEAT_TOOLS)[number];
/** Chuleta: [clave del titulo, comando]. Usa el host del trabajo y las rutas de diccionario guardadas. */
export function cheatSheet(tool: CheatTool, wordlists: LabWordlist[], host: string): Array<[string, string]> {
  const wl = (id: string) => wordlists.find((d) => d.id === id)?.path || `<${id}>`;
  const H = safeHost(host) || "<host>";
  const DIR = wl("dir"), SUB = wl("sub"), FFUF = wl("ffuf");
  const C: Record<CheatTool, Array<[string, string]>> = {
    nmap: [["allPorts", `nmap -p- --min-rate 5000 -T4 -oN nmap-allports.txt ${H}`], ["versions", `nmap -sVC -p <puertos> -oN nmap-serv.txt ${H}`], ["udp", `nmap -sU --top-ports 50 ${H}`], ["help", "nmap -h"]],
    ffuf: [["dirs", `ffuf -w ${DIR}:FUZZ -u http://${H}/FUZZ -e .php,.txt,.html -ic -o ffuf.json`], ["vhosts", `ffuf -w ${SUB}:FUZZ -u http://${H}/ -H "Host: FUZZ.<dominio>" -fs <tam>`], ["raft", `ffuf -w ${FFUF}:FUZZ -u http://${H}/FUZZ -ic`], ["help", "ffuf -h"]],
    gobuster: [["dirs", `gobuster dir -u http://${H} -w ${DIR} -x php,txt,html -o gobuster.txt`], ["vhosts", `gobuster vhost -u http://${H} -w ${SUB} --append-domain`], ["help", "gobuster dir -h"]],
    dirb: [["basic", `dirb http://${H}/ ${DIR}`], ["ext", `dirb http://${H}/ ${DIR} -X .php,.txt`], ["help", "dirb"]],
  };
  return C[tool];
}

export interface ReportLabels { target: string; host: string; scope: string; started: string; findings: string; none: string; severity: string; family: string; where: string; status: string; hypotheses: string; steps: string; tools: string; cves: string; cveSoftware: string; services: string; families: Record<Family, string>; severities: Record<Severity, string>; states: Record<FindingState, string>; hypothesisStates: Record<HypothesisState, string>; cveStates: Record<CveState, string> }

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** Informe del trabajo en Markdown, listo para pegar en la plataforma de bug bounty o en las notas del laboratorio. */
export function toMarkdown(p: LabProject, L: ReportLabels): string {
  const lines: string[] = [`# ${p.name}`, ""];
  if (p.target.name) lines.push(`- **${L.target}:** ${p.target.name}`);
  if (p.target.host) lines.push(`- **${L.host}:** ${p.target.host}`);
  if (p.target.started) lines.push(`- **${L.started}:** ${p.target.started}`);
  if (p.target.scope) lines.push(`- **${L.scope}:** ${p.target.scope.replace(/\n+/g, " ")}`);
  lines.push("", `## ${L.findings}`, "");
  const findings = [...p.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  if (findings.length === 0) lines.push(L.none, "");
  findings.forEach((f, i) => {
    lines.push(`### ${i + 1}. ${f.title}`, "", `- **${L.severity}:** ${L.severities[f.severity]}`, `- **${L.family}:** ${L.families[f.family]}`);
    if (f.where) lines.push(`- **${L.where}:** \`${f.where.replace(/`/g, "'")}\``);
    lines.push(`- **${L.status}:** ${L.states[f.status]}`, "");
    if (f.notes) lines.push(f.notes, "");
  });
  if (p.services.length) {
    lines.push(`## ${L.services}`, "");
    [...p.services].sort((a, b) => a.port - b.port).forEach((sv) => {
      const head = [`${sv.port}/${sv.proto}`, sv.name, sv.version].filter(Boolean).join(" · ");
      lines.push(`- ${head}${sv.notes ? ` — ${sv.notes.replace(/\n+/g, " ")}` : ""}`);
    });
    lines.push("");
  }
  if (p.cves.length) {
    lines.push(`## ${L.cves}`, "");
    [...p.cves].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]).forEach((c) => {
      const head = [c.id, c.software && `${c.software}${c.version ? " " + c.version : ""}`].filter(Boolean).join(" — ");
      lines.push(`- **${head}** · ${L.severities[c.severity]} · ${L.cveStates[c.state]}`);
      const ref = cveRef(c);
      if (ref) lines.push(`  - ${ref}`);
      if (c.notes) lines.push(`  - ${c.notes.replace(/\n+/g, " ")}`);
    });
    lines.push("");
  }
  if (p.hypotheses.length) lines.push(`## ${L.hypotheses}`, "", ...p.hypotheses.map((h, i) => `${i + 1}. ${h.txt} (${L.hypothesisStates[h.state]})`), "");
  if (p.steps.length) lines.push(`## ${L.steps}`, "", ...p.steps.map((s) => `- [${s.ok ? "x" : " "}] ${s.t}`), "");
  if (p.tools.length) lines.push(`## ${L.tools}`, "", p.tools.join(", "), "");
  return lines.join("\n").trimEnd() + "\n";
}

/** Resumen para la cabecera: trabajos, hallazgos y pasos hechos del trabajo activo. */
export function progressOf(p: LabProject): { done: number; total: number; percent: number } {
  const total = p.steps.length;
  const done = p.steps.filter((s) => s.ok).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}
