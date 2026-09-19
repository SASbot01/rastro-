// Registra el webhook del bot de Telegram y sus textos. Se ejecuta EN EL SERVIDOR, una vez:
//   cd ~/rastro && node scripts/telegram-setup.mjs
// Lee TELEGRAM_BOT_TOKEN de .env.local; si falta TELEGRAM_WEBHOOK_SECRET lo genera y lo añade al archivo.
// Nunca imprime el token ni el secreto.
import { readFileSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const token = env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error("Falta TELEGRAM_BOT_TOKEN en .env.local"); process.exit(1); }
let secret = env.TELEGRAM_WEBHOOK_SECRET;
let created = false;
if (!secret) { secret = randomBytes(32).toString("hex"); appendFileSync(".env.local", `\nTELEGRAM_WEBHOOK_SECRET=${secret}\n`); created = true; }
const site = (env.NEXT_PUBLIC_SITE_URL || "https://rastropro.com").replace(/\/$/, "");
const call = async (method, body) => { const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); console.log(method, "->", j.ok ? "ok" : `ERROR ${j.error_code}: ${j.description}`); return j; };

const me = await call("getMe", {});
if (!me.ok) process.exit(1);
await call("setWebhook", { url: `${site}/api/telegram/webhook`, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true, max_connections: 10 });
await call("setMyCommands", { commands: [{ command: "start", description: "Cómo funciona" }, { command: "privacidad", description: "Qué hacemos con tus mensajes" }] });
await call("setMyCommands", { language_code: "en", commands: [{ command: "start", description: "How it works" }, { command: "privacy", description: "What we do with your messages" }] });
await call("setMyDescription", { description: "Reenvíame un SMS, correo o WhatsApp sospechoso y te digo si es una estafa, por qué y qué hacer. No guardo tus mensajes. De Rastro (rastropro.com)." });
await call("setMyShortDescription", { short_description: "¿Es una estafa? Reenvíame el mensaje y te lo digo. De Rastro." });
console.log(`Bot: @${me.result.username}`);
console.log(created ? "Secreto del webhook generado y guardado: REINICIA la app para que lo lea." : "Secreto del webhook: ya existia.");
