/**
 * Núcleo del ejecutor local de reconocimiento (puro y testeable).
 *
 * Construye comandos de RECON/ENUMERACIÓN con lista blanca, el host del
 * trabajo como argumento ya atado (sin shell, sin comandos libres) y un
 * candado de alcance. No hay explotación aquí: solo reconocimiento.
 */
export const RECON_TOOLS = {
  // tool: (host, opts) -> [binario, ...args]   (nunca pasa por shell)
  nmap_fast: (h) => ["nmap", "-p-", "--min-rate", "5000", "-T4", "-Pn", "-n", h],
  nmap_services: (h, o) => ["nmap", "-sVC", "-Pn", "-n", "-p", String(o.ports || "").replace(/[^0-9,\-]/g, "") || "1-1024", h],
  nmap_udp: (h) => ["nmap", "-sU", "--top-ports", "50", "-Pn", "-n", h],
  whatweb: (h) => ["whatweb", "-a", "3", `http://${h}`],
  curl_headers: (h) => ["curl", "-sS", "-I", "--max-time", "15", `http://${h}`],
  ffuf_dirs: (h, o) => ["ffuf", "-w", `${o.wordlist || "/usr/share/wordlists/dirb/common.txt"}:FUZZ`, "-u", `http://${h}/FUZZ`, "-ic", "-t", "40"],
  gobuster_dirs: (h, o) => ["gobuster", "dir", "-u", `http://${h}`, "-w", o.wordlist || "/usr/share/wordlists/dirb/common.txt", "-q"],
};

/** Un host es válido para recon: dominio, IP v4 o v6 entre corchetes. Nada de metacaracteres. */
export function validHost(host) {
  const h = String(host || "").trim();
  if (!h || h.length > 255) return false;
  return /^[a-z0-9.-]+$/i.test(h) || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || /^\[[0-9a-f:]+\]$/i.test(h);
}

/** Glob simple: "10.10.*", "*.htb", "10.129.0.0/16"(prefijo textual). Coincidencia por patrón, no regex libre. */
export function hostInScope(host, scopeList) {
  const h = String(host || "").toLowerCase();
  const scopes = (Array.isArray(scopeList) ? scopeList : String(scopeList || "").split(",")).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (scopes.length === 0) return false; // sin alcance definido, no se ejecuta nada real
  return scopes.some((pat) => {
    if (pat === "*") return true;
    const re = new RegExp("^" + pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9.-]*") + "$");
    return re.test(h);
  });
}

/**
 * Devuelve { bin, args } para un recon autorizado, o { error }.
 * Exige: herramienta de la lista, host válido y dentro del alcance.
 */
export function buildReconCommand({ tool, host, scope, opts = {} }) {
  if (!RECON_TOOLS[tool]) return { error: `Herramienta no permitida: ${tool}. Solo recon/enumeración: ${Object.keys(RECON_TOOLS).join(", ")}.` };
  if (!validHost(host)) return { error: "Host no válido o sin fijar en el trabajo." };
  if (!hostInScope(host, scope)) return { error: `El host ${host} está fuera del alcance permitido (RASTRO_RUNNER_SCOPE). No se ejecuta.` };
  const argv = RECON_TOOLS[tool](host, opts);
  return { bin: argv[0], args: argv.slice(1), cmd: argv.join(" ") };
}

/** Extrae servicios de una salida de nmap: "22/tcp open ssh OpenSSH 8.2". */
export function parseNmapServices(output) {
  const out = [];
  for (const line of String(output || "").split("\n")) {
    const m = line.match(/^(\d{1,5})\/(tcp|udp)\s+open\s+(\S+)(?:\s+(.*))?$/i);
    if (m) out.push({ port: Number(m[1]), proto: m[2].toLowerCase(), name: m[3], version: (m[4] || "").trim().slice(0, 160) });
  }
  return out;
}
