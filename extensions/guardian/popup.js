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
