// Capturas de la app en movil (390x844 @3x) con Chrome oculto via CDP. Sin dependencias.
// Uso: node shoot.mjs <cookie_rastro_session>
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const BASE = "http://localhost:3000";
const cookie = process.argv[2];
const REPORT = process.argv[3] || "";
// ONLY=nombre1,nombre2 limita las capturas (p. ej. para repetir una sola con otro informe)
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
// OUT_DIR: carpeta de salida (por defecto, esta misma)
const OUT_DIR = process.env.OUT_DIR || here;

const shots = [
  { name: "landing", path: "/", auth: false },
  { name: "panel", path: "/", auth: true },
  { name: "informe", path: `/informe/${REPORT}`, auth: true },
  { name: "perfil", path: "/cuenta", auth: true },
  { name: "herramientas", path: "/herramientas", auth: true },
  { name: "informes", path: "/informe", auth: true },
  // Informe abierto por la seccion "Lo que dice la IA"
  { name: "informe-ia", path: `/informe/${REPORT}`, auth: true, prep: "document.querySelectorAll('details').forEach(d=>d.open=true); const h=[...document.querySelectorAll('summary')].find(x=>/dice la IA/.test(x.textContent)); if(h){ window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 90); }" },
  // Informe abierto por "Filtraciones"
  { name: "informe-filtraciones", path: `/informe/${REPORT}`, auth: true, prep: "document.querySelectorAll('details').forEach(d=>d.open=true); const h=[...document.querySelectorAll('summary')].find(x=>/Filtraciones/.test(x.textContent)); if(h){ window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 90); }" },
];

const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--user-data-dir=/tmp/rastro-shots-profile`, "about:blank"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const { webSocketDebuggerUrl } = await (await fetch(`http://localhost:${PORT}/json/version`)).json();
const ws = new WebSocket(webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
const s = (m, p) => send(m, p, sessionId);
await s("Page.enable"); await s("Network.enable");
await s("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await s("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });

for (const shot of shots) {
  if (ONLY && !ONLY.includes(shot.name)) continue;
  if (!shot.path.includes("undefined") && !(shot.name === "informe" && !REPORT)) {
    await s("Network.clearBrowserCookies");
    if (shot.auth && cookie) await s("Network.setCookie", { name: "rastro_session", value: cookie, url: BASE });
    await s("Page.navigate", { url: BASE + shot.path });
    await new Promise((r) => setTimeout(r, 3500));
    // Ocultar el globo de Next dev tools
    if (shot.prep) { await s("Runtime.evaluate", { expression: shot.prep }); await new Promise((r) => setTimeout(r, 800)); }
    await s("Runtime.evaluate", { expression: "document.querySelectorAll('nextjs-portal').forEach(e=>e.remove());" });
    const { result: { data } } = await s("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(join(OUT_DIR, `${shot.name}.png`), Buffer.from(data, "base64"));
    console.log(shot.name + ".png");
  }
}
ws.close(); chrome.kill();
