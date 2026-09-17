/* global chrome */
import { analyzeCookies, baseDomain, summarize } from "./lib/analyze.js";
import { REJECT_TEXTS } from "./lib/trackers.js";

/**
 * Service worker: recibe del content script el sitio, los terceros que carga y si hay
 * un aviso de cookies a la vista; lee las cookies (solo metadatos) y devuelve el resumen.
 * Nada sale del navegador: no hay ninguna llamada de red en esta extension.
 */
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
      const hosts = Array.isArray(msg.thirdPartyHosts) ? msg.thirdPartyHosts.filter((h) => typeof h === "string").slice(0, 200) : [];
      const cookies = await cookiesFor(url.href, hosts);
      const report = analyzeCookies({ siteHost: url.hostname, cookies, thirdPartyHosts: hosts, bannerVisible: Boolean(msg.bannerVisible), https: url.protocol === "https:" });
      const locale = chrome.i18n.getUILanguage().startsWith("es") ? "es" : "en";
      const level = report.level === "green" ? "#4dfc5f" : report.level === "orange" ? "#ffb020" : "#ff5f5f";
      chrome.action.setBadgeText({ tabId: sender.tab.id, text: String(report.score) });
      chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: level });
      await chrome.storage.session.set({ [`report:${sender.tab.id}`]: { report, lines: summarize(report, locale) } });
      reply({ ok: true, report, lines: summarize(report, locale), rejectTexts: REJECT_TEXTS });
    } catch (e) {
      reply({ ok: false, error: String(e) });
    }
  })();
  return true; // respuesta asincrona
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`report:${tabId}`));
