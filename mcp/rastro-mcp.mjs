#!/usr/bin/env node
/**
 * Rastro MCP — conecta Claude con tu cuenta de Rastro (rastropro.com).
 *
 * Deja que Claude lleve tus reportes de bug bounty en Rastro Lab (crear
 * trabajos, añadir hallazgos y CVE, sacar el informe en Markdown) y use las
 * herramientas de defensa (informe de exposición de un dominio, guardián de
 * estafas, catálogo de sitios que venden datos). Solo toca TU cuenta.
 *
 * Sin dependencias: habla el protocolo MCP (JSON-RPC 2.0 por stdio, mensajes
 * separados por saltos de línea) directamente. Node 18+.
 *
 * Configúralo con dos variables de entorno:
 *   RASTRO_API_KEY   tu clave rk_live_... (Perfil → API en rastropro.com)
 *   RASTRO_BASE_URL  opcional, por defecto https://rastropro.com
 */
import { createInterface } from "node:readline";

const BASE = (process.env.RASTRO_BASE_URL || "https://rastropro.com").replace(/\/$/, "");
const KEY = process.env.RASTRO_API_KEY || "";
const NAME = "rastro";
const VERSION = "1.0.0";

async function api(method, path, body) {
  if (!KEY) throw new Error("Falta RASTRO_API_KEY (tu clave rk_live_... de rastropro.com/cuenta).");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json", accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

const S = (desc, props = {}, required = []) => ({ type: "object", description: desc, properties: props, required, additionalProperties: false });
const str = (description) => ({ type: "string", description });
const FAMILIES = ["access", "logic", "auth", "ssrf", "injection", "xss", "info", "config", "other"];
const SEVERITIES = ["critical", "high", "medium", "low", "info"];
const FINDING_STATES = ["draft", "reported", "accepted", "duplicate", "rejected"];
const CVE_STATES = ["investigating", "vulnerable", "exploited", "patched", "not_applicable"];

/** Cada herramienta: nombre, descripción, esquema de entrada y cómo se ejecuta. */
const TOOLS = [
  {
    name: "lab_list_jobs",
    description: "Lista tus trabajos de Rastro Lab (bug bounty / laboratorios) con su objetivo y cuántos pasos, hallazgos y CVE tiene cada uno.",
    schema: S("Sin parámetros."),
    run: () => api("GET", "/api/v1/lab"),
  },
  {
    name: "lab_get_job",
    description: "Devuelve un trabajo completo (objetivo, pasos, hipótesis, CVE, hallazgos).",
    schema: S("Identifica el trabajo.", { job: str("id del trabajo (de lab_list_jobs)") }, ["job"]),
    run: (a) => api("POST", "/api/v1/lab", { action: "get", job: a.job }),
  },
  {
    name: "lab_create_job",
    description: "Crea un trabajo nuevo en Rastro Lab (por ejemplo, una máquina de HTB o un programa de bug bounty). Trabaja solo sobre objetivos autorizados.",
    schema: S("Datos del trabajo.", { name: str("nombre del trabajo"), host: str("IP o host del objetivo (opcional)"), scope: str("programa y alcance autorizado (opcional)") }, ["name"]),
    run: (a) => api("POST", "/api/v1/lab", { action: "create_job", name: a.name, host: a.host, scope: a.scope }),
  },
  {
    name: "lab_add_finding",
    description: "Añade un hallazgo a un trabajo: título, dónde (URL/endpoint), familia, gravedad, estado y notas (pasos para reproducir, impacto).",
    schema: S("Hallazgo.", { job: str("id del trabajo"), title: str("título del hallazgo"), where: str("URL o endpoint"), family: { type: "string", enum: FAMILIES }, severity: { type: "string", enum: SEVERITIES }, status: { type: "string", enum: FINDING_STATES }, notes: str("notas: reproducción, impacto, evidencia") }, ["job", "title"]),
    run: (a) => api("POST", "/api/v1/lab", { action: "add_finding", ...a }),
  },
  {
    name: "lab_add_cve",
    description: "Registra un CVE o vulnerabilidad conocida del software del objetivo (id, software, versión, gravedad, estado, notas y enlace al aviso).",
    schema: S("CVE.", { job: str("id del trabajo"), id: str("CVE-AAAA-NNNN u otro identificador"), software: str("software afectado"), version: str("versión"), severity: { type: "string", enum: SEVERITIES }, state: { type: "string", enum: CVE_STATES }, notes: str("cómo se dispara, qué da"), ref: str("enlace al aviso (opcional)") }, ["job"]),
    run: (a) => api("POST", "/api/v1/lab", { action: "add_cve", ...a }),
  },
  {
    name: "lab_add_hypothesis",
    description: "Añade una hipótesis de ataque al trabajo (dónde crees que puede fallar el objetivo).",
    schema: S("Hipótesis.", { job: str("id del trabajo"), text: str("la hipótesis"), state: { type: "string", enum: ["open", "confirmed", "discarded"] } }, ["job", "text"]),
    run: (a) => api("POST", "/api/v1/lab", { action: "add_hypothesis", job: a.job, text: a.text, state: a.state }),
  },
  {
    name: "lab_report_markdown",
    description: "Devuelve el informe del trabajo en Markdown (hallazgos ordenados por gravedad, CVE, hipótesis, pasos), listo para pegar en la plataforma de bug bounty.",
    schema: S("Identifica el trabajo.", { job: str("id del trabajo") }, ["job"]),
    run: (a) => api("POST", "/api/v1/lab", { action: "report", job: a.job }),
  },
  {
    name: "domain_report",
    description: "Defensa: informe de exposición de un DOMINIO de empresa — correo (SPF/DMARC), seguridad web, dominios parecidos registrados y qué dice la IA. Nivel empresa, sin datos personales. Úsalo sobre dominios tuyos o de clientes con permiso.",
    schema: S("Dominio a analizar.", { domain: str("dominio, p. ej. ejemplo.es"), refresh: { type: "boolean", description: "fuerza regenerar en vez de usar la caché de 7 días" } }, ["domain"]),
    run: (a) => api("POST", "/api/v1/domain-report", { domain: a.domain, refresh: Boolean(a.refresh) }),
  },
  {
    name: "guardian_check",
    description: "Defensa: analiza si un mensaje (SMS, correo, WhatsApp) es una estafa y por qué. Requiere Rastro Pro.",
    schema: S("Mensaje sospechoso.", { text: str("el mensaje completo"), sender: str("remitente, si lo sabes"), personalize: { type: "boolean", description: "cruza con tu último informe" } }, ["text"]),
    run: (a) => api("POST", "/api/v1/guardian", { text: a.text, sender: a.sender, personalize: Boolean(a.personalize), locale: "es" }),
  },
  {
    name: "sites_catalog",
    description: "Catálogo de sitios que publican o venden datos personales (brokers, buscadores de personas), con su contacto de privacidad y pasos de baja.",
    schema: S("Sin parámetros."),
    run: () => api("GET", "/api/v1/sites"),
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/* ---- transporte MCP: JSON-RPC 2.0 por stdio, un mensaje por línea ---- */
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }
function reply(id, result) { send({ jsonrpc: "2.0", id, result }); }
function fail(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return reply(id, { protocolVersion: params?.protocolVersion || "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: NAME, version: VERSION } });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return;
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") {
    return reply(id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.schema })) });
  }
  if (method === "tools/call") {
    const tool = BY_NAME.get(params?.name);
    if (!tool) return fail(id, -32602, `Herramienta desconocida: ${params?.name}`);
    try {
      const out = await tool.run(params.arguments || {});
      return reply(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
    } catch (e) {
      return reply(id, { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true });
    }
  }
  if (id !== undefined) fail(id, -32601, `Método no soportado: ${method}`);
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const t = line.trim();
  if (!t) return;
  let msg; try { msg = JSON.parse(t); } catch { return; }
  Promise.resolve(handle(msg)).catch((e) => { if (msg?.id !== undefined) fail(msg.id, -32603, String(e?.message || e)); });
});
