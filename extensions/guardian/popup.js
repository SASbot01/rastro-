/* global chrome */
const message = document.querySelector("#message");
const status = document.querySelector("#status");
const tr = (key) => chrome.i18n.getMessage(key);
document.documentElement.lang = chrome.i18n.getUILanguage().startsWith("es") ? "es" : "en";
for (const node of document.querySelectorAll("[data-message]")) node.textContent = tr(node.dataset.message);

document.querySelector("#selection").addEventListener("click", async () => {
  status.textContent = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url ?? "")) throw new Error("restricted");
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const text = window.getSelection()?.toString() ?? "";
      return { text: text.slice(0, 4000), truncated: text.length > 4000 };
    } });
    const selected = results[0]?.result;
    message.value = selected?.text ?? "";
    status.textContent = !message.value ? tr("empty") : selected.truncated ? tr("truncated") : "";
  } catch { status.textContent = tr("error"); }
});
document.querySelector("#open").addEventListener("click", async () => {
  const text = message.value.trim();
  if (!text) { status.textContent = tr("empty"); return; }
  try {
    await navigator.clipboard.writeText(text);
    // No message in query strings, fragments, storage, telemetry or network calls.
    await chrome.tabs.create({ url: "https://rastropro.com/guardian" });
    status.textContent = tr("copied");
  } catch { status.textContent = tr("copyError"); }
});
document.querySelector("#clear").addEventListener("click", () => { message.value = ""; status.textContent = ""; message.focus(); });

/* ---------- Cookies de la pestana actual (lo calcula el service worker; aqui solo se muestra) ---------- */
const $ = (id) => document.getElementById(id);
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const key = `report:${tab?.id}`;
  const data = tab?.id ? (await chrome.storage.session.get(key))[key] : null;
  if (!data) { $("first").textContent = tr("cookiesEmpty"); return; }
  const { report, lines } = data;
  $("score").textContent = String(report.score); $("score").classList.add(report.level);
  $("host").textContent = report.siteHost; $("first").textContent = lines[0] ?? "";
  lines.slice(1).forEach((line, i) => { const li = document.createElement("li"); li.textContent = line; if (i >= 1) li.className = "flag"; $("lines").appendChild(li); });
  report.companies.slice(0, 14).forEach((c) => { const s = document.createElement("span"); s.className = `chip ${c.category}`; s.textContent = c.company; $("chips").appendChild(s); });
  if (report.cookies.length) {
    $("detailBox").hidden = false;
    report.cookies.forEach((c) => { const li = document.createElement("li"); const a = document.createElement("span"); a.textContent = `${c.name} · ${c.domain}`; const b = document.createElement("span"); b.textContent = `${c.company ?? c.category}${c.session ? "" : ` · ${c.days}d`}`; li.append(a, b); $("cookieList").appendChild(li); });
  }
})();
chrome.storage.local.get(["variant", "enabled"], (cfg) => { $("variant").value = cfg.variant ?? "vigia"; $("enabled").checked = cfg.enabled !== false; });
$("variant").addEventListener("change", (e) => chrome.storage.local.get(["mascot"], (m) => chrome.storage.local.set({ variant: e.target.value, mascot: { ...(m.mascot ?? {}), variant: e.target.value } })));
$("enabled").addEventListener("change", (e) => chrome.storage.local.set({ enabled: e.target.checked }));
