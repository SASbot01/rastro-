// Prueba real de la extension: Chrome con la extension cargada, abre una web y lee lo que pinta el robot.
// Uso: node scripts/test-extension.mjs https://www.elmundo.es [salida.png]   (SHOT_SIZE=1280,800 para capturas de tienda)
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const url = process.argv[2] || "https://www.elmundo.es";
const out = process.argv[3] || "";
const ext = resolve("extensions/guardian");
const profile = mkdtempSync(join(tmpdir(), "rastro-ext-"));
const PORT = 9444;
const BROWSER = process.env.BROWSER_BIN || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"; // Chrome de marca ya no acepta --load-extension
const chrome = spawn(BROWSER, [`--remote-debugging-port=${PORT}`, "--headless=new", `--user-data-dir=${profile}`, `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--no-first-run", ...(process.env.EXTRA_FLAGS ? process.env.EXTRA_FLAGS.split(" ").map((f) => f.replaceAll("+", " ")) : []), `--window-size=${process.env.SHOT_SIZE || "1280,900"}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await sleep(250); } }
  // BLOCK=1: activa el bloqueo de rastreadores desde el service worker de la extension antes de abrir la web.
  if (process.env.BLOCK === "1") {
    let sw;
    for (let i = 0; i < 20 && !sw; i++) { sw = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "service_worker" && t.url.includes("background.js")); if (!sw) await sleep(300); }
    if (sw) {
      const w = new WebSocket(sw.webSocketDebuggerUrl);
      await new Promise((r) => (w.onopen = r));
      const done = new Promise((r) => (w.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) r(d); }));
      w.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { awaitPromise: true, returnByValue: true, expression: "chrome.storage.local.set({blockTrackers:true}).then(() => new Promise(r => setTimeout(r, 600))).then(() => chrome.declarativeNetRequest.getEnabledRulesets())" } }));
      const out = await done; console.log("reglas activas:", JSON.stringify(out.result?.result?.value ?? out)); w.close();
    } else console.log("no encuentro el service worker");
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable");
  await send("Page.navigate", { url });
  await sleep(11000);
  const res = await send("Runtime.evaluate", { returnByValue: true, expression: `(() => { const h = document.querySelector('[data-rastro-mascot]'); if (!h) return { robot: false }; const r = h.shadowRoot; const bot = r.querySelector('.bot'); const panel = r.querySelector('.panel'); if (panel.hidden) { bot.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:10,clientY:10,button:0,pointerId:1})); bot.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:10,clientY:10,button:0,pointerId:1})); } return { robot: true, alert: r.querySelector('.alert-title')?.textContent ?? null, alertLines: [...r.querySelectorAll('.alert-lines li')].map(n => n.textContent), alertButtons: [...r.querySelectorAll('.alert .actions button')].map(n => n.textContent), badge: r.querySelector('.badge').textContent, host: r.querySelector('.host')?.textContent, lines: [...r.querySelectorAll('.lines li')].map(n => n.textContent), chips: [...r.querySelectorAll('.chip')].map(n => n.textContent), buttons: [...r.querySelectorAll('.actions button')].map(n => n.textContent) }; })()` });
  console.log(JSON.stringify(res.result.value, null, 1));
  if (out) { const shot = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(out, Buffer.from(shot.data, "base64")); console.log("captura:", out); }
  ws.close();
} finally { chrome.kill(); }
