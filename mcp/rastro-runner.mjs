#!/usr/bin/env node
/**
 * Rastro Runner — ejecutor LOCAL de reconocimiento para laboratorios y bug bounty.
 *
 * Corre en TU máquina de ataque (tu VPS con la VPN de HTB), NO en los
 * servidores de Rastro. Claude, por MCP, le pide reconocimiento sobre el
 * objetivo del trabajo activo; el runner lo ejecuta y guarda la salida en el
 * Lab de tu cuenta. Es RECON/ENUMERACIÓN con lista blanca (nmap, whatweb,
 * curl, ffuf, gobuster): no ejecuta exploits ni shells. Eso lo corres tú a mano.
 *
 * Salvaguardas:
 *   - El trabajo debe tener host y estar marcado "autorizado".
 *   - El host debe estar dentro de RASTRO_RUNNER_SCOPE (p. ej. "10.10.*,*.htb").
 *   - Sin RASTRO_RUNNER_ENABLE=1 solo hace simulacro (enseña el comando, no lo lanza).
 *   - Sin shell: el host va como argumento atado; nada de comandos libres.
 *
 * Variables: RASTRO_API_KEY (rk_live_…), RASTRO_BASE_URL (def. https://rastropro.com),
 *   RASTRO_RUNNER_SCOPE (globs de alcance), RASTRO_RUNNER_ENABLE=1 (para lanzar de verdad).
 */
import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { buildReconCommand, parseNmapServices, RECON_TOOLS } from "./runner-core.mjs";

const BASE = (process.env.RASTRO_BASE_URL || "https://rastropro.com").replace(/\/$/, "");
const KEY = process.env.RASTRO_API_KEY || "";
const SCOPE = process.env.RASTRO_RUNNER_SCOPE || "";
const ENABLED = process.env.RASTRO_RUNNER_ENABLE === "1";
const MAX_OUTPUT = 20000;

async function api(method, path, body) {
  if (!KEY) throw new Error("Falta RASTRO_API_KEY.");
  const res = await fetch(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}
async function getJob(job) { return api("POST", "/api/v1/lab", { action: "get", job }); }

function runCommand(bin, args) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 300000, maxBuffer: 4 * 1024 * 1024, killSignal: "SIGKILL" }, (err, stdout, stderr) => {
      const out = ((stdout || "") + (stderr ? "\n" + stderr : "")).slice(0, MAX_OUTPUT);
      if (err && err.code === "ENOENT") resolve({ ok: false, out: `No encuentro "${bin}" en esta máquina. Instálalo o usa otra herramienta.` });
      else resolve({ ok: true, out: out || "(sin salida)" });
    });
  });
}

const TOOLS = [
  {
    name: "recon_plan",
    description: "Muestra el objetivo del trabajo activo y qué herramientas de reconocimiento puede lanzar el runner (lista blanca), si hay alcance definido y si el modo real está activado.",
    schema: { type: "object", properties: { job: { type: "string", description: "id del trabajo (de lab_list_jobs)" } }, required: ["job"], additionalProperties: false },
    run: async (a) => {
      const j = await getJob(a.job);
      return { target: { host: j.target?.host || "", authorized: j.target?.authorized === true, scope: j.target?.scope || "" }, runner_scope: SCOPE || "(sin definir)", mode: ENABLED ? "ejecución real" : "simulacro (RASTRO_RUNNER_ENABLE no está a 1)", tools: Object.keys(RECON_TOOLS) };
    },
  },
  {
    name: "recon_run",
    description: "Ejecuta en TU máquina una herramienta de reconocimiento (lista blanca: " + Object.keys(RECON_TOOLS).join(", ") + ") contra el host del trabajo, y guarda la salida en el Lab. Solo si el trabajo está autorizado y el host entra en el alcance. Sin RASTRO_RUNNER_ENABLE=1 solo devuelve el comando (simulacro). No ejecuta exploits.",
    schema: { type: "object", properties: { job: { type: "string", description: "id del trabajo" }, tool: { type: "string", enum: Object.keys(RECON_TOOLS), description: "herramienta de recon" }, ports: { type: "string", description: "puertos para nmap_services, p. ej. 22,80,3000" }, wordlist: { type: "string", description: "diccionario para ffuf/gobuster" } }, required: ["job", "tool"], additionalProperties: false },
    run: async (a) => {
      const j = await getJob(a.job);
      const host = j.target?.host || "";
      if (!j.target?.authorized) return { refused: "El trabajo no está marcado como autorizado. Márcalo (lab_set_target authorized=true) solo si tienes permiso." };
      const built = buildReconCommand({ tool: a.tool, host, scope: SCOPE, opts: { ports: a.ports, wordlist: a.wordlist } });
      if (built.error) return { refused: built.error };
      if (!ENABLED) return { dry_run: true, would_run: built.cmd, note: "Simulacro. Exporta RASTRO_RUNNER_ENABLE=1 en el runner para ejecutar de verdad." };
      const { out } = await runCommand(built.bin, built.args);
      await api("POST", "/api/v1/lab", { action: "add_log", job: a.job, tool: a.tool.split("_")[0], cmd: built.cmd, output: out }).catch(() => {});
      const services = a.tool.startsWith("nmap") ? parseNmapServices(out) : [];
      for (const sv of services) await api("POST", "/api/v1/lab", { action: "add_service", job: a.job, port: sv.port, proto: sv.proto, name: sv.name, version: sv.version }).catch(() => {});
      return { ran: built.cmd, services_saved: services.length, output: out };
    },
  },
];
const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

function send(m) { process.stdout.write(JSON.stringify(m) + "\n"); }
function reply(id, result) { send({ jsonrpc: "2.0", id, result }); }
async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") return reply(id, { protocolVersion: params?.protocolVersion || "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "rastro-runner", version: "1.0.0" } });
  if (method && method.startsWith("notifications/")) return;
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") return reply(id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.schema })) });
  if (method === "tools/call") {
    const tool = BY_NAME.get(params?.name);
    if (!tool) return send({ jsonrpc: "2.0", id, error: { code: -32602, message: "Herramienta desconocida" } });
    try { const out = await tool.run(params.arguments || {}); return reply(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] }); }
    catch (e) { return reply(id, { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true }); }
  }
  if (id !== undefined) send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Método no soportado: ${method}` } });
}
// Procesa las peticiones EN ORDEN (una tras otra): evita que dos escrituras del cuaderno compitan.
let chain = Promise.resolve();
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => { const t = line.trim(); if (!t) return; let m; try { m = JSON.parse(t); } catch { return; } chain = chain.then(() => handle(m)).catch(() => {}); });
