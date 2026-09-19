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

  function pageSignals() {
    var hasPassword = false, hasCard = false;
    try {
      hasPassword = Array.prototype.some.call(document.querySelectorAll("input[type='password']"), visible);
      hasCard = Array.prototype.some.call(document.querySelectorAll("input[autocomplete='cc-number'],input[name*='cardnumber' i],input[name*='card_number' i],input[id*='cardnumber' i],input[name*='tarjeta' i],input[placeholder*='1234 5678' i]"), visible);
    } catch (e) { /* DOM raro */ }
    return { hasPassword: hasPassword, hasCard: hasCard };
  }

  var mascot = null, rejectTexts = [], shownRisk = "";
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
    chrome.runtime.sendMessage({ type: "rastro:analyze", thirdPartyHosts: thirdPartyHosts(), bannerVisible: bannerVisible(), signals: pageSignals() }, function (res) {
      if (chrome.runtime.lastError || !res || !res.ok || !mascot) return;
      rejectTexts = res.rejectTexts || [];
      mascot.setReport(res.report, res.lines);
      showRisk(res.risk);
    });
  }

  // Web que imita a otra: el robot se pone en rojo y abre la burbuja solo. Una vez por nivel (no insiste en cada recuento).
  function showRisk(risk) {
    if (!risk || risk.level === "none") { if (shownRisk) { shownRisk = ""; mascot.alert(null); } return; }
    if (shownRisk === risk.level) return;
    shownRisk = risk.level;
    var actions = [];
    if (risk.official) actions.push({ label: t("goOfficial").replace("{site}", risk.official), primary: true, run: function () { location.href = risk.officialUrl; } });
    actions.push({ label: t("leave"), primary: !risk.official, run: function () { if (history.length > 1) history.back(); else location.href = "about:blank"; } });
    actions.push({ label: t("trustSite"), run: function (api) { chrome.storage.local.get(["trustedHosts"], function (h) { chrome.storage.local.set({ trustedHosts: (h.trustedHosts || []).concat(location.hostname).slice(-300) }); shownRisk = ""; api.alert(null); }); } });
    mascot.alert({ level: risk.level, title: risk.title, lines: risk.lines, actions: actions });
  }

  chrome.storage.local.get(["hiddenHosts", "variant", "enabled"], function (cfg) {
    if (cfg.enabled === false || (cfg.hiddenHosts || []).indexOf(location.hostname) >= 0) { analyzeSilently(); return; }
    start(cfg);
  });

  function start(cfg) {
    var memory = { getItem: function () { return JSON.stringify(cfg.mascot || (cfg.variant ? { variant: cfg.variant } : null)); }, setItem: function (k, v) { try { var o = JSON.parse(v); chrome.storage.local.set({ mascot: o, variant: o.variant }); } catch (e) { /* nada */ } } };
    chrome.storage.local.get(["mascot"], function (m) {
      cfg.mascot = m.mascot;
      mascot = RastroMascot.create({
        storage: memory,
        labels: { title: "Rastro Guardián", privacy: t("bubblePrivacy"), waiting: t("waiting"), robots: ["Rastro", "Vigía", "Cubo", "Orbe"] },
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
  }

  // Robot oculto o desactivado: se sigue contando para el icono y, si la web imita a otra, el robot aparece igualmente.
  function analyzeSilently() {
    chrome.runtime.sendMessage({ type: "rastro:analyze", thirdPartyHosts: thirdPartyHosts(), bannerVisible: bannerVisible(), signals: pageSignals() }, function (res) {
      if (chrome.runtime.lastError || !res || !res.ok || !res.risk || res.risk.level !== "danger" || mascot) return;
      chrome.storage.local.get(["variant"], function (cfg) { start(cfg); });
    });
    // Un segundo vistazo (los formularios de acceso a veces tardan en pintarse) y ya.
    if (silentRuns++ < 1) setTimeout(function () { if (!mascot) analyzeSilently(); }, 4000);
  }
  var silentRuns = 0;
})();
