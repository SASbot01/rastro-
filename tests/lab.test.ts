import test from "node:test";
import assert from "node:assert/strict";
import { cheatSheet, defaultWorkspace, importLegacy, isLegacy, progressOf, safeHost, sanitizeWorkspace, toMarkdown, type ReportLabels } from "../lib/lab-core.ts";

const LEGACY = {
  activo: "p20260901",
  proyectos: { p20260901: { nombre: "Maquina Lame", creado: "01/09/2026 10:00", objetivo: { nombre: "Lame", ip: "10.10.10.3", inicio: "01/09 10:00" },
    pasos: [{ t: "Escaneo de puertos y servicios", ok: true }, { t: "Explotación", ok: false }],
    hipotesis: [{ txt: "Samba vulnerable", estado: "confirmada" }, { txt: "FTP anónimo", estado: "descartada" }],
    herramientas: ["nmap", "nmap", "smbclient"],
    hallazgos: [{ tit: "IDOR en /api/user", donde: "/api/user/2", fam: "control de acceso / IDOR", notas: "cambia el id" }] } },
  servidores: [{ nombre: "Mini PC", accion: "ssh_minipc" }, { nombre: "VPS bug bounty", accion: "ssh_vps" }],
  diccionarios: [{ id: "dir", cat: "directorios", ruta: "/home/bugbounty/dir.txt" }],
};

test("importa el datos.json de la app local sin perder nada", () => {
  assert.equal(isLegacy(LEGACY), true);
  const w = importLegacy(LEGACY, "es")!;
  const p = w.projects.p20260901;
  assert.equal(w.active, "p20260901");
  assert.equal(p.target.host, "10.10.10.3");
  assert.deepEqual(p.hypotheses.map((h) => h.state), ["confirmed", "discarded"]);
  assert.deepEqual(p.tools, ["nmap", "smbclient"]);
  assert.deepEqual([p.findings[0].family, p.findings[0].severity, p.findings[0].status], ["access", "medium", "draft"]);
  assert.deepEqual(w.servers, [{ name: "Mini PC", cmd: "ssh minipc" }, { name: "VPS bug bounty", cmd: "ssh bugbounty-vps" }]);
  assert.equal(w.wordlists[0].path, "/home/bugbounty/dir.txt");
  assert.deepEqual(progressOf(p), { done: 1, total: 2, percent: 50 });
});

test("lo que llega del navegador se limpia: tipos, topes y tamaño", () => {
  const dirty = { active: "nope", projects: { "ok-1": { name: "x".repeat(500), target: { host: 5, authorized: "yes" }, steps: [{ t: "", ok: true }, { t: "a", ok: 1 }], hypotheses: [{ txt: "h", state: "hackeada" }], tools: [" nmap ", 7], findings: [{ title: "t", family: "raro", severity: "apocalipsis", status: "x", notes: "n" }, { title: "" }] }, "../../etc": {} } };
  const w = sanitizeWorkspace(dirty, "es")!;
  assert.deepEqual(Object.keys(w.projects), ["ok-1"]);
  assert.equal(w.active, "ok-1");
  const p = w.projects["ok-1"];
  assert.equal(p.name.length, 120);
  assert.deepEqual([p.target.host, p.target.authorized], ["", false]);
  assert.deepEqual(p.steps, [{ t: "a", ok: false }]);
  assert.equal(p.hypotheses[0].state, "open");
  assert.deepEqual(p.tools, ["nmap"]);
  assert.deepEqual([p.findings.length, p.findings[0].family, p.findings[0].severity, p.findings[0].status], [1, "other", "medium", "draft"]);
  const huge = Object.fromEntries(Array.from({ length: 6 }, (_, k) => [`p${k}`, { name: "a", findings: Array.from({ length: 200 }, () => ({ title: "t", notes: "x".repeat(8000) })) }]));
  assert.equal(sanitizeWorkspace({ projects: huge }, "es"), null);
  assert.equal(Object.keys(sanitizeWorkspace({}, "en")!.projects).length, 1);
});

test("la chuleta usa el host del trabajo y nunca mete texto raro en el comando", () => {
  const w = defaultWorkspace("es");
  assert.equal(safeHost("http://lab.htb/login"), "lab.htb");
  assert.equal(safeHost("10.10.10.3; rm -rf ~"), "");
  assert.match(cheatSheet("nmap", w.wordlists, "10.10.10.3")[0][1], /nmap -p- .* 10\.10\.10\.3$/);
  assert.match(cheatSheet("ffuf", w.wordlists, "x; curl evil")[0][1], /http:\/\/<host>\/FUZZ/);
  assert.match(cheatSheet("gobuster", [], "a.b")[0][1], /-w <dir> /);
});

test("el informe en Markdown ordena los hallazgos por gravedad", () => {
  const L: ReportLabels = { target: "Objetivo", host: "Host", scope: "Alcance", started: "Inicio", findings: "Hallazgos", none: "Sin hallazgos.", severity: "Gravedad", family: "Familia", where: "Dónde", status: "Estado", hypotheses: "Hipótesis", steps: "Pasos", tools: "Herramientas", cves: "CVE", cveSoftware: "Software", services: "Servicios",
    families: { access: "Control de acceso", logic: "Lógica", auth: "Autenticación", ssrf: "SSRF", injection: "Inyección", xss: "XSS", info: "Información", config: "Configuración", other: "Otra" },
    severities: { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja", info: "Informativa" }, states: { draft: "Borrador", reported: "Reportado", accepted: "Aceptado", duplicate: "Duplicado", rejected: "Rechazado" }, hypothesisStates: { open: "abierta", confirmed: "confirmada", discarded: "descartada" }, cveStates: { investigating: "investigando", vulnerable: "vulnerable", exploited: "explotado", patched: "parcheado", not_applicable: "no aplica" } };
  const w = importLegacy(LEGACY, "es")!;
  const p = w.projects.p20260901;
  p.findings.push({ title: "RCE", where: "/upload", family: "injection", severity: "critical", status: "reported", notes: "", at: "" });
  const md = toMarkdown(p, L);
  assert.ok(md.indexOf("### 1. RCE") < md.indexOf("### 2. IDOR en /api/user"));
  assert.match(md, /- \[x\] Escaneo de puertos y servicios/);
  assert.match(md, /1\. Samba vulnerable \(confirmada\)/);
});

import { cleanUrl, cveRef, normalizeCveId, sanitizeWorkspace as sw2 } from "../lib/lab-core.ts";
test("normaliza el id del CVE y enlaza a NVD cuando no hay referencia propia", () => {
  assert.equal(normalizeCveId("cve 2025 64512"), "CVE-2025-64512");
  assert.equal(normalizeCveId("CVE-2025-64512"), "CVE-2025-64512");
  assert.equal(normalizeCveId("2021-44228"), "CVE-2021-44228");
  assert.equal(normalizeCveId("GHSA-xxxx-yyyy"), "GHSA-XXXX-YYYY");
  assert.equal(cveRef({ id: "CVE-2025-64512", ref: "" }), "https://nvd.nist.gov/vuln/detail/CVE-2025-64512");
  assert.equal(cveRef({ id: "CVE-2025-64512", ref: "https://pdfminer.example/advisory" }), "https://pdfminer.example/advisory");
});
test("las URL peligrosas de los CVE se descartan al limpiar", () => {
  assert.equal(cleanUrl("javascript:alert(1)"), "");
  assert.equal(cleanUrl("https://nvd.nist.gov/vuln/detail/CVE-2025-64512"), "https://nvd.nist.gov/vuln/detail/CVE-2025-64512");
  const w = sw2({ projects: { a: { name: "a", cves: [{ id: "cve-2025-64512", software: "pdfminer.six", severity: "muy", state: "nope", ref: "javascript:1" }, { id: "", software: "" }] } } }, "es")!;
  const cve = w.projects.a.cves;
  assert.equal(cve.length, 1);
  assert.deepEqual([cve[0].id, cve[0].severity, cve[0].state, cve[0].ref], ["CVE-2025-64512", "medium", "investigating", ""]);
});
