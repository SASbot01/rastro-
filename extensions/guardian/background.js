/* global chrome */
import { analyzeCookies, baseDomain, summarize } from "./lib/analyze.js";
import { REJECT_TEXTS, TRACKER_DOMAINS, blockedDomains } from "./lib/trackers.js";
import { assessSite, describeRisk } from "./lib/phishing.js";

/**
 * Service worker: recibe del content script el sitio, los terceros que carga y si hay
 * un aviso de cookies a la vista; lee las cookies (solo metadatos) y devuelve el resumen.
 * Tambien mira si el dominio imita a una marca conocida (lib/phishing.js) y, si la persona lo activa,
 * bloquea rastreadores con reglas estaticas (declarativeNetRequest).
 * Nada sale del navegador: no hay ninguna llamada de red en esta extension.
 */
const BLOCKED = blockedDomains();
const meta = (c) => ({ name: c.name, domain: c.domain, expirationDate: c.expirationDate, session: c.session, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite });

async function cookiesFor(url, thirdPartyHosts) {
  const own = await chrome.cookies.getAll({ url });
  const domains = [...new Set(thirdPartyHosts.map(baseDomain))].slice(0, 40);
  const third = (await Promise.all(domains.map((domain) => chrome.cookies.getAll({ domain }).catch(() => [])))).flat();
  return [...own, ...third].map(meta);
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== "rastro:analyze" || !sender.tab?.url) return false;
  (async () => {
    try {
      const url = new URL(sender.tab.url);
      const seen = Array.isArray(msg.thirdPartyHosts) ? msg.thirdPartyHosts.filter((h) => typeof h === "string").slice(0, 200) : [];
      // Con el bloqueo activo, lo bloqueado no llega a cargarse: no cuenta como "te sigue", cuenta como "bloqueado".
      const { blockTrackers = false } = await chrome.storage.local.get(["blockTrackers"]);
      const cut = blockTrackers ? BLOCKED : [];
      const isCut = (h) => cut.some((d) => h === d || h.endsWith("." + d));
      const hosts = seen.filter((h) => !isCut(h));
      const blockedCompanies = [...new Set(seen.filter(isCut).map((h) => TRACKER_DOMAINS[cut.find((d) => h === d || h.endsWith("." + d))][0]))].sort();
      const cookies = await cookiesFor(url.href, hosts);
      const report = analyzeCookies({ siteHost: url.hostname, cookies, thirdPartyHosts: hosts, bannerVisible: Boolean(msg.bannerVisible), https: url.protocol === "https:" });
      const locale = chrome.i18n.getUILanguage().startsWith("es") ? "es" : "en";
      const lines = summarize(report, locale);
      if (blockedCompanies.length) lines.splice(1, 0, (locale === "es" ? `He bloqueado a ${blockedCompanies.length} ${blockedCompanies.length === 1 ? "empresa" : "empresas"} en esta página: ` : `I blocked ${blockedCompanies.length} ${blockedCompanies.length === 1 ? "company" : "companies"} on this page: `) + blockedCompanies.slice(0, 5).join(", ") + (blockedCompanies.length > 5 ? "…" : "."));
      const { trustedHosts = [] } = await chrome.storage.local.get(["trustedHosts"]);
      const sig = msg.signals || {};
      const assessed = trustedHosts.includes(url.hostname) ? { level: "none", reasons: [], brand: null } : assessSite({ host: url.hostname, https: url.protocol === "https:", hasPassword: Boolean(sig.hasPassword), hasCard: Boolean(sig.hasCard) });
      const said = describeRisk(assessed, locale);
      const risk = { level: assessed.level, reasons: assessed.reasons, title: said.title, lines: said.lines, official: assessed.brand?.official ?? null, officialUrl: assessed.brand?.url ?? null, brand: assessed.brand?.name ?? null };
      const level = report.level === "green" ? "#4dfc5f" : report.level === "orange" ? "#ffb020" : "#ff5f5f";
      chrome.action.setBadgeText({ tabId: sender.tab.id, text: risk.level === "danger" ? "!" : String(report.score) });
      chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: risk.level === "danger" ? "#ff5f5f" : level });
      await chrome.storage.session.set({ [`report:${sender.tab.id}`]: { report, lines, risk } });
      reply({ ok: true, report, lines, rejectTexts: REJECT_TEXTS, risk });
    } catch (e) {
      reply({ ok: false, error: String(e) });
    }
  })();
  return true; // respuesta asincrona
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`report:${tabId}`));


// Bloqueo de rastreadores (opcional, apagado por defecto): activa o desactiva el paquete de reglas estaticas.
async function applyBlocking() {
  const { blockTrackers = false } = await chrome.storage.local.get(["blockTrackers"]);
  await chrome.declarativeNetRequest.updateEnabledRulesets(blockTrackers ? { enableRulesetIds: ["trackers"] } : { disableRulesetIds: ["trackers"] });
}
chrome.runtime.onInstalled.addListener(applyBlocking);
chrome.runtime.onStartup.addListener(applyBlocking);
chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.blockTrackers) applyBlocking(); });
