/* global chrome, RastroMascot */
(function () {
  "use strict";
  if (window.top !== window || !/^https?:$/.test(location.protocol)) return;
  var t = function (key) { return chrome.i18n.getMessage(key) || key; };
  var BANNERS = "#onetrust-banner-sdk,#onetrust-consent-sdk,#CybotCookiebotDialog,#didomi-notice,.didomi-popup-container,.qc-cmp2-container,#cookie-law-info-bar,.cky-consent-container,#cmplz-cookiebanner-container,.cc-window,#cookie-notice,#cookiescript_injected,.fc-consent-root,#usercentrics-root,[id*='cookie-banner' i],[class*='cookie-banner' i],[class*='cookie-consent' i],[id*='cookieconsent' i],[aria-label*='cookies' i][role='dialog']";

  function visible(n) { var r = n.getBoundingClientRect(); var s = getComputedStyle(n); return r.width > 40 && r.height > 20 && s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.05; }
  function bannerVisible() { try { return Array.prototype.some.call(document.querySelectorAll(BANNERS), visible); } catch (e) { return false; } }
  function thirdPartyHosts() {
    var hosts = new Set();
    try { performance.getEntriesByType("resource").forEach(function (e) { try { hosts.add(new URL(e.name).hostname); } catch (err) { /* url rara */ } }); } catch (e) { /* sin API */ }
    document.querySelectorAll("script[src],iframe[src],img[src]").forEach(function (n) { try { hosts.add(new URL(n.src, location.href).hostname); } catch (err) { /* nada */ } });
    hosts.delete(location.hostname);
    return Array.from(hosts).slice(0, 200);
  }

  var mascot = null, rejectTexts = [];
  function clickReject() {
    var nodes = document.querySelectorAll("button,a[role='button'],[role='button'],input[type='button'],input[type='submit']");
    var best = null, bestRank = 99;
    nodes.forEach(function (n) {
      if (!visible(n)) return;
      var label = (n.innerText || n.value || n.getAttribute("aria-label") || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (!label || label.length > 40) return;
      var rank = rejectTexts.findIndex(function (x) { return label === x || label.startsWith(x); });
      if (rank >= 0 && rank < bestRank) { best = n; bestRank = rank; }
    });
    if (!best) { mascot.say([t("rejectMissing")]); return; }
    best.click();
    mascot.say([t("rejected")]);
    setTimeout(analyze, 2500); // volver a contar: ¿de verdad rechazo?
  }

  function analyze() {
    chrome.runtime.sendMessage({ type: "rastro:analyze", thirdPartyHosts: thirdPartyHosts(), bannerVisible: bannerVisible() }, function (res) {
      if (chrome.runtime.lastError || !res || !res.ok || !mascot) return;
      rejectTexts = res.rejectTexts || [];
      mascot.setReport(res.report, res.lines);
    });
  }

  chrome.storage.local.get(["hiddenHosts", "variant", "enabled"], function (cfg) {
    if (cfg.enabled === false || (cfg.hiddenHosts || []).indexOf(location.hostname) >= 0) { analyzeSilently(); return; }
    var memory = { getItem: function () { return JSON.stringify(cfg.mascot || (cfg.variant ? { variant: cfg.variant } : null)); }, setItem: function (k, v) { try { var o = JSON.parse(v); chrome.storage.local.set({ mascot: o, variant: o.variant }); } catch (e) { /* nada */ } } };
    chrome.storage.local.get(["mascot"], function (m) {
      cfg.mascot = m.mascot;
      mascot = RastroMascot.create({
        storage: memory,
        labels: { title: "Rastro Guardián", privacy: t("bubblePrivacy"), waiting: t("waiting"), robots: ["Vigía", "Cubo", "Orbe"] },
        actions: [
          { label: t("reject"), primary: true, run: clickReject },
          { label: t("more"), run: function () { window.open("https://rastropro.com/sitios", "_blank", "noopener"); } },
          { label: t("hide"), run: function (api) { chrome.storage.local.get(["hiddenHosts"], function (h) { chrome.storage.local.set({ hiddenHosts: (h.hiddenHosts || []).concat(location.hostname).slice(-500) }); api.destroy(); }); } },
        ],
      });
      analyze();
      setTimeout(analyze, 4000); // las webs siguen cargando rastreadores tras el primer vistazo
      // Tras cada clic (p. ej. aceptar o rechazar el aviso) se vuelve a contar, como mucho cada 3 s.
      var pending = null;
      document.addEventListener("click", function () { if (pending) return; pending = setTimeout(function () { pending = null; analyze(); }, 3000); }, true);
    });
  });

  function analyzeSilently() { chrome.runtime.sendMessage({ type: "rastro:analyze", thirdPartyHosts: thirdPartyHosts(), bannerVisible: bannerVisible() }, function () { void chrome.runtime.lastError; }); }
})();
