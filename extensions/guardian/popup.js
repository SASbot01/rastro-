/* global chrome */
const tr = (key) => chrome.i18n.getMessage(key);
document.documentElement.lang = chrome.i18n.getUILanguage().startsWith("es") ? "es" : "en";
for (const node of document.querySelectorAll("[data-message]")) node.textContent = tr(node.dataset.message);

/* ---------- Cookies de la pestana actual (lo calcula el service worker; aqui solo se muestra) ---------- */
const $ = (id) => document.getElementById(id);
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const key = `report:${tab?.id}`;
  const data = tab?.id ? (await chrome.storage.session.get(key))[key] : null;
  if (!data) { $("first").textContent = tr("cookiesEmpty"); return; }
  const { report, lines, risk } = data;
  if (risk && risk.level !== "none") {
    $("risk").hidden = false; $("risk").classList.add(risk.level);
    $("riskTitle").textContent = risk.title;
    risk.lines.forEach((line) => { const li = document.createElement("li"); li.textContent = line; $("riskLines").appendChild(li); });
    if (risk.officialUrl) { $("riskGo").hidden = false; $("riskGo").href = risk.officialUrl; $("riskGo").textContent = tr("goOfficial").replace("{site}", risk.official); }
  }
  $("score").textContent = String(report.score); $("score").classList.add(report.level);
  $("host").textContent = report.siteHost; $("first").textContent = lines[0] ?? "";
  lines.slice(1).forEach((line, i) => { const li = document.createElement("li"); li.textContent = line; if (i >= 1) li.className = "flag"; $("lines").appendChild(li); });
  report.companies.slice(0, 14).forEach((c) => { const s = document.createElement("span"); s.className = `chip ${c.category}`; s.textContent = c.company; $("chips").appendChild(s); });
  if (report.cookies.length) {
    $("detailBox").hidden = false;
    report.cookies.forEach((c) => { const li = document.createElement("li"); const a = document.createElement("span"); a.textContent = `${c.name} · ${c.domain}`; const b = document.createElement("span"); b.textContent = `${c.company ?? c.category}${c.session ? "" : ` · ${c.days}d`}`; li.append(a, b); $("cookieList").appendChild(li); });
  }
})();
chrome.storage.local.get(["variant", "enabled", "blockTrackers"], (cfg) => { $("variant").value = cfg.variant ?? "avatar"; $("enabled").checked = cfg.enabled !== false; $("block").checked = cfg.blockTrackers === true; });
$("block").addEventListener("change", (e) => chrome.storage.local.set({ blockTrackers: e.target.checked }));
$("variant").addEventListener("change", (e) => chrome.storage.local.get(["mascot"], (m) => chrome.storage.local.set({ variant: e.target.value, mascot: { ...(m.mascot ?? {}), variant: e.target.value } })));
$("enabled").addEventListener("change", (e) => chrome.storage.local.set({ enabled: e.target.checked }));
