/* Rastro Guardian - robotitos arrastrables.
 * Script clasico (sin imports): funciona como content script de la extension y como <script> en la web.
 * Cabeza grande que sigue al puntero; el cuerpo cuelga del cuello como un pendulo con muelle,
 * brazos y antena con su propio retardo (tambaleo tipo Mii). Todo dentro de un shadow DOM.
 */
(function () {
  "use strict";
  if (globalThis.RastroMascot) return;

  var VARIANTS = ["avatar", "vigia", "cubo", "orbe"];
  var COLORS = { green: "#4dfc5f", orange: "#ffb020", red: "#ff5f5f", idle: "#4dfc5f" };
  var SCALE = 0.68; // mas pequeno en pantalla; el dibujo sigue en 120x172
  var VW = 120, VH = 172, W = Math.round(VW * SCALE), H = Math.round(VH * SCALE), NECK_X = 60, NECK_Y = 96;

  function el(tag, attrs, parent) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- Dibujo de los tres robots (SVG) ---------- */
  function drawAvatarBody(g, accent) {
    var legs = el("g", { class: "legs" }, g);
    // pantalon cargo
    el("path", { d: "M42 132 L46 160 L58 160 L60 138 L62 160 L74 160 L78 132 Z", fill: "#111", stroke: "#262626" }, legs);
    el("rect", { x: 43, y: 142, width: 8, height: 7, rx: 2, fill: "#1c1c1c" }, legs);
    el("rect", { x: 69, y: 142, width: 8, height: 7, rx: 2, fill: "#1c1c1c" }, legs);
    // zapatillas con suela verde
    el("path", { d: "M40 160 h20 v6 a3 3 0 0 1 -3 3 h-19 a3 3 0 0 1 -3 -3 v-1 a5 5 0 0 1 5 -5 z", fill: "#161616", stroke: "#2a2a2a" }, legs);
    el("path", { d: "M60 160 h20 a5 5 0 0 1 5 5 v1 a3 3 0 0 1 -3 3 h-19 a3 3 0 0 1 -3 -3 z", fill: "#161616", stroke: "#2a2a2a" }, legs);
    el("rect", { x: 35, y: 166, width: 25, height: 2.5, rx: 1, fill: COLORS.idle, opacity: 0.9 }, legs);
    el("rect", { x: 60, y: 166, width: 25, height: 2.5, rx: 1, fill: COLORS.idle, opacity: 0.9 }, legs);
    // brazos de la chaqueta (manos en los bolsillos)
    var armL = el("g", { class: "armL" }, g);
    el("path", { d: "M36 102 C26 108 24 122 30 132 L42 130 L40 104 Z", fill: "#181818", stroke: "#2a2a2a" }, armL);
    var armR = el("g", { class: "armR" }, g);
    el("path", { d: "M84 102 C94 108 96 122 90 132 L78 130 L80 104 Z", fill: "#181818", stroke: "#2a2a2a" }, armR);
    // sudadera (capucha bajada) + chaqueta abierta
    el("path", { d: "M40 98 C40 90 80 90 80 98 L84 134 L36 134 Z", fill: "#0f0f0f", stroke: "#262626" }, g);
    el("path", { d: "M40 96 C46 90 74 90 80 96 L82 104 L60 100 L38 104 Z", fill: "#1a1a1a", stroke: "#2a2a2a" }, g);
    el("path", { d: "M36 100 L50 98 L52 134 L36 134 Z", fill: "#171717", stroke: "#2a2a2a" }, g);
    el("path", { d: "M84 100 L70 98 L68 134 L84 134 Z", fill: "#171717", stroke: "#2a2a2a" }, g);
    el("rect", { x: 59, y: 100, width: 2, height: 32, fill: "#2c2c2c" }, g); // cremallera
    el("path", { d: "M52 104 L58 118 M68 104 L62 118", stroke: "#2e2e2e", "stroke-width": 1.5, fill: "none" }, g); // cordones
    el("rect", { x: 74, y: 110, width: 7, height: 6, rx: 1.5, fill: "#0a0a0a", stroke: "#2a2a2a" }, g); // parche
    var light = el("rect", { class: "accent-fill", x: 75.5, y: 111.5, width: 4, height: 3, rx: 0.8, fill: accent }, g);
    return { armL: armL, armR: armR, legs: legs, light: light };
  }

  function drawAvatarHead(g, accent) {
    var parts = { eyes: [], lids: [], antenna: null, screenText: null };
    // pasamontanas (cabeza grande)
    el("path", { d: "M14 60 C14 24 36 6 60 6 C84 6 106 24 106 60 C106 84 92 98 60 98 C28 98 14 84 14 60 Z", fill: "#121212", stroke: "#262626", "stroke-width": 2 }, g);
    // textura de punto sutil
    for (var i = 0; i < 6; i++) el("path", { d: "M" + (22 + i * 13) + " 74 q6 -6 12 0", fill: "none", stroke: "#1a1a1a", "stroke-width": 1 }, g);
    // gorra con la R (mas grande que la cabeza, ligeramente ladeada)
    el("path", { d: "M12 40 C18 14 40 4 60 4 C80 4 102 14 108 40 C92 32 76 30 60 30 C44 30 28 32 12 40 Z", fill: "#161616", stroke: "#2c2c2c" }, g);
    el("path", { d: "M8 40 C24 36 44 34 60 34 C76 34 96 36 118 44 C102 46 80 44 60 44 C40 44 22 44 8 40 Z", fill: "#1c1c1c", stroke: "#2c2c2c" }, g);
    el("rect", { x: 57, y: 3, width: 6, height: 3, rx: 1.5, fill: "#2c2c2c" }, g);
    var r = el("g", { fill: COLORS.idle, transform: "translate(50,10) scale(0.44)" }, g);
    el("path", { d: "M4 2 H30 C40 2 46 8 46 16 C46 23 41 28 34 29 L46 44 H36 L20 22 H30 C34 22 36 20 36 16 C36 12 34 10 30 10 H10 Z" }, r);
    el("path", { d: "M0 22 H8 L12 28 H3 Z M5 32 H14 L21 44 H11 Z" }, r);
    // ojos: aro claro, iris verde, pupila oscura, brillo
    [40, 80].forEach(function (cx) {
      var eg = el("g", { class: "eye" }, g);
      el("circle", { cx: cx, cy: 62, r: 15, fill: "#e9e4d8" }, eg);
      el("circle", { cx: cx, cy: 62, r: 11.5, fill: COLORS.idle }, eg);
      el("circle", { cx: cx + 1, cy: 63, r: 5.5, fill: "#0a0a0a" }, eg);
      el("circle", { cx: cx + 4, cy: 57, r: 2.6, fill: "#ffffff", opacity: 0.9 }, eg);
      parts.eyes.push(eg);
      parts.lids.push(el("rect", { class: "lid", x: cx - 16, y: 46, width: 32, height: 0, rx: 4, fill: "#121212" }, g));
    });
    return parts;
  }

  function drawBody(g, accent) {
    // piernas (cuelgan un poco mas que el torso)
    var legs = el("g", { class: "legs" }, g);
    el("rect", { x: 44, y: 138, width: 11, height: 22, rx: 5, fill: "#1b1b1b", stroke: "#2e2e2e" }, legs);
    el("rect", { x: 65, y: 138, width: 11, height: 22, rx: 5, fill: "#1b1b1b", stroke: "#2e2e2e" }, legs);
    el("rect", { x: 40, y: 157, width: 18, height: 9, rx: 4.5, fill: "#262626" }, legs);
    el("rect", { x: 62, y: 157, width: 18, height: 9, rx: 4.5, fill: "#262626" }, legs);
    // brazos (grupos con pivote en el hombro)
    var armL = el("g", { class: "armL" }, g);
    el("rect", { x: 27, y: 104, width: 10, height: 30, rx: 5, fill: "#1b1b1b", stroke: "#2e2e2e" }, armL);
    el("circle", { cx: 32, cy: 136, r: 6, fill: "#262626" }, armL);
    var armR = el("g", { class: "armR" }, g);
    el("rect", { x: 83, y: 104, width: 10, height: 30, rx: 5, fill: "#1b1b1b", stroke: "#2e2e2e" }, armR);
    el("circle", { cx: 88, cy: 136, r: 6, fill: "#262626" }, armR);
    // torso
    el("rect", { x: 38, y: 98, width: 44, height: 44, rx: 14, fill: "#151515", stroke: "#2e2e2e", "stroke-width": 1.5 }, g);
    el("rect", { x: 47, y: 108, width: 26, height: 16, rx: 6, fill: "#0a0a0a", stroke: "#262626" }, g);
    var light = el("circle", { class: "accent-fill", cx: 60, cy: 116, r: 4.5, fill: accent }, g);
    el("rect", { x: 50, y: 130, width: 20, height: 3, rx: 1.5, fill: "#262626" }, g);
    return { armL: armL, armR: armR, legs: legs, light: light };
  }

  function drawHead(variant, g, accent) {
    var parts = { eyes: [], lids: [], antenna: null, screenText: null };
    if (variant === "cubo") {
      parts.antenna = el("g", { class: "antenna" }, g);
      el("path", { d: "M60 12 C60 0 76 0 76 -8", fill: "none", stroke: "#2e2e2e", "stroke-width": 4, "stroke-linecap": "round" }, parts.antenna);
      el("circle", { class: "accent-fill", cx: 76, cy: -10, r: 5, fill: accent }, parts.antenna);
      el("rect", { x: 10, y: 10, width: 100, height: 84, rx: 18, fill: "#151515", stroke: "#2e2e2e", "stroke-width": 2 }, g);
      el("rect", { x: 20, y: 20, width: 80, height: 58, rx: 10, fill: "#060606", stroke: "#1f1f1f" }, g);
      parts.screenText = el("text", { class: "accent-text", x: 60, y: 58, "text-anchor": "middle", "font-family": "ui-monospace,Menlo,monospace", "font-size": 24, "font-weight": 700, fill: accent }, g);
      parts.screenText.textContent = "OK";
      el("rect", { x: 28, y: 84, width: 16, height: 4, rx: 2, fill: "#262626" }, g);
      el("circle", { class: "accent-fill", cx: 88, cy: 86, r: 2.5, fill: accent }, g);
    } else if (variant === "orbe") {
      parts.antenna = el("g", { class: "antenna" }, g);
      el("rect", { x: 57, y: -4, width: 6, height: 14, rx: 3, fill: "#2e2e2e" }, parts.antenna);
      el("circle", { class: "accent-fill", cx: 60, cy: -7, r: 5, fill: accent }, parts.antenna);
      el("rect", { x: 2, y: 40, width: 12, height: 24, rx: 6, fill: "#1b1b1b", stroke: "#2e2e2e" }, g);
      el("rect", { x: 106, y: 40, width: 12, height: 24, rx: 6, fill: "#1b1b1b", stroke: "#2e2e2e" }, g);
      el("circle", { cx: 60, cy: 52, r: 47, fill: "#151515", stroke: "#2e2e2e", "stroke-width": 2 }, g);
      el("circle", { cx: 60, cy: 52, r: 30, fill: "#060606", stroke: "#1f1f1f" }, g);
      var eye = el("g", { class: "eye" }, g);
      el("circle", { class: "accent-fill", cx: 60, cy: 52, r: 17, fill: accent }, eye);
      el("circle", { cx: 60, cy: 52, r: 7, fill: "#0a0a0a" }, eye);
      el("circle", { cx: 66, cy: 46, r: 4, fill: "#ffffff", opacity: 0.85 }, eye);
      parts.eyes.push(eye);
      parts.lids.push(el("rect", { class: "lid", x: 28, y: 20, width: 64, height: 0, fill: "#060606" }, g));
    } else {
      // vigia: la mascota de Rastro en version robot (capucha, gorra con la R, ojos verdes)
      el("path", { d: "M8 58 C8 18 34 2 60 2 C86 2 112 18 112 58 C112 82 100 96 60 96 C20 96 8 82 8 58 Z", fill: "#121212", stroke: "#2a2a2a", "stroke-width": 2 }, g);
      el("path", { d: "M22 60 C22 40 40 30 60 30 C80 30 98 40 98 60 C98 80 84 90 60 90 C36 90 22 80 22 60 Z", fill: "#070707" }, g);
      el("path", { d: "M18 34 C26 14 44 8 60 8 C76 8 94 14 102 34 C86 28 72 26 60 26 C48 26 34 28 18 34 Z", fill: "#1b1b1b", stroke: "#2e2e2e" }, g);
      el("path", { d: "M60 26 C80 26 104 30 116 40 C104 40 84 36 60 36 Z", fill: "#202020", stroke: "#2e2e2e" }, g);
      var r = el("g", { class: "accent-fill", fill: accent, transform: "translate(51,11) scale(0.42)" }, g);
      el("path", { d: "M4 2 H30 C40 2 46 8 46 16 C46 23 41 28 34 29 L46 44 H36 L20 22 H30 C34 22 36 20 36 16 C36 12 34 10 30 10 H10 Z" }, r);
      el("path", { d: "M0 22 H8 L12 28 H3 Z M5 32 H14 L21 44 H11 Z" }, r);
      [40, 80].forEach(function (cx) {
        var eg = el("g", { class: "eye" }, g);
        el("ellipse", { class: "accent-fill", cx: cx, cy: 60, rx: 13, ry: 15, fill: accent }, eg);
        el("ellipse", { cx: cx + 1, cy: 62, rx: 5.5, ry: 7, fill: "#0a0a0a" }, eg);
        el("circle", { cx: cx + 4, cy: 55, r: 3, fill: "#ffffff", opacity: 0.85 }, eg);
        parts.eyes.push(eg);
        parts.lids.push(el("rect", { class: "lid", x: cx - 15, y: 43, width: 30, height: 0, fill: "#070707" }, g));
      });
    }
    return parts;
  }

  var CSS = [
    ":host{all:initial}",
    ".wrap{position:fixed;left:0;top:0;z-index:2147483646;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f4f4f2;pointer-events:none}",
    ".bot{position:absolute;width:" + W + "px;height:" + Math.round((VH + 16) * SCALE) + "px;cursor:grab;touch-action:none;pointer-events:auto;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 10px 18px rgba(0,0,0,.55))}",
    ".bot.drag{cursor:grabbing}",
    ".bot svg{overflow:visible;display:block}",
    ".badge{position:absolute;right:-8px;top:-4px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:#0a0a0a;border:2px solid var(--accent);color:var(--accent);font-weight:700;font-size:11px;line-height:18px;text-align:center;box-sizing:border-box}",
    ".badge[hidden]{display:none}",
    ".panel{position:absolute;width:312px;max-width:calc(100vw - 24px);box-sizing:border-box;background:#151515;border:1px solid #262626;border-radius:20px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.6);pointer-events:auto;font-size:13.5px;line-height:1.5}",
    ".panel[hidden]{display:none}",
    ".head{display:flex;align-items:center;gap:12px}",
    ".score{position:relative;width:54px;height:54px;flex:none}",
    ".score b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:var(--accent)}",
    ".title{font-size:14px;font-weight:600;margin:0}.host{font-size:12px;color:#a3a39e;margin:0;word-break:break-all}",
    ".lines{margin:12px 0 0;padding:0;list-style:none;display:grid;gap:7px}.lines li{color:#d8d8d4}.lines li.flag{color:#f4f4f2;padding-left:10px;border-left:2px solid var(--accent)}",
    ".chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.chip{font-size:11.5px;padding:3px 8px;border-radius:999px;background:#1d1d1d;border:1px solid #2a2a2a;color:#a3a39e}.chip.broker{border-color:#ff5f5f66;color:#ff8d8d}.chip.ads{border-color:#ffb02055;color:#ffc861}",
    ".actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}",
    ".alert{margin:-4px -4px 14px;padding:12px 12px 13px;border-radius:14px;border:1px solid #ff5f5f;background:rgba(255,95,95,.12)}.alert.suspicious{border-color:#ffb020;background:rgba(255,176,32,.10)}.alert-title{margin:0;font-weight:700;font-size:14.5px;line-height:1.35;color:#fff}.alert-lines{margin:8px 0 0;padding:0;list-style:none;display:grid;gap:5px;color:#e8e8e4;font-size:13px}.alert .actions{margin-top:11px}.alert .actions button.primary{background:#ff5f5f;border-color:#ff5f5f;color:#0a0a0a}.alert.suspicious .actions button.primary{background:#ffb020;border-color:#ffb020}",
    "button{font:inherit;cursor:pointer;border-radius:12px;padding:9px 12px;font-weight:600;font-size:13px;border:1px solid #2a2a2a;background:#1d1d1d;color:#f4f4f2}",
    "button.primary{background:#4dfc5f;color:#0a0a0a;border-color:#4dfc5f}",
    "button:focus-visible{outline:2px solid #4dfc5f;outline-offset:2px}",
    ".foot{margin-top:10px;font-size:11.5px;color:#6f6f6a}",
    ".pick{display:flex;gap:6px;margin-top:10px}.pick button{padding:5px 9px;font-size:12px;font-weight:500}.pick button[aria-pressed=true]{border-color:#4dfc5f;color:#4dfc5f}",
  ].join("");

  function create(opts) {
    opts = opts || {};
    var labels = Object.assign({ title: "Rastro", reject: "Rechazar por mí", hide: "Ocultar aquí", more: "Ver en Rastro", privacy: "Todo se comprueba en tu navegador. No enviamos tus cookies a ningún sitio.", robots: ["Rastro", "Vigía", "Cubo", "Orbe"], waiting: "Mirando esta web…" }, opts.labels || {});
    var variant = VARIANTS.indexOf(opts.variant) >= 0 ? opts.variant : "avatar";
    var reduced = !!(globalThis.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    var host = document.createElement("div");
    host.setAttribute("data-rastro-mascot", "");
    var root = host.attachShadow({ mode: "open" });
    var style = document.createElement("style"); style.textContent = CSS; root.appendChild(style);
    var wrap = h("div", "wrap", root);
    wrap.style.setProperty("--accent", COLORS.idle);
    var bot = h("div", "bot", wrap);
    bot.setAttribute("role", "button"); bot.setAttribute("tabindex", "0"); bot.setAttribute("aria-label", labels.title);
    var badge = h("div", "badge", bot); badge.hidden = true;
    var panel = h("div", "panel", wrap); panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", labels.title);

    var svg, headG, bodyG, body, head;
    function build() {
      if (svg) svg.remove();
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 -16 " + VW + " " + (VH + 16)); svg.setAttribute("width", W); svg.setAttribute("height", Math.round((VH + 16) * SCALE));
      bodyG = el("g", { class: "body" }, svg);
      body = variant === "avatar" ? drawAvatarBody(bodyG, accent()) : drawBody(bodyG, accent());
      headG = el("g", { class: "headg" }, svg);
      head = variant === "avatar" ? drawAvatarHead(headG, accent()) : drawHead(variant, headG, accent());
      bot.insertBefore(svg, badge);
      paintState();
    }

    var state = { level: "idle", score: null, report: null, lines: [], alert: null };
    function accent() { if (state.alert) return state.alert.level === "danger" ? COLORS.red : COLORS.orange; return COLORS[state.level] || COLORS.idle; }
    function paintState() {
      var a = accent();
      wrap.style.setProperty("--accent", a);
      root.querySelectorAll(".accent-fill").forEach(function (n) { n.setAttribute("fill", a); });
      root.querySelectorAll(".accent-text").forEach(function (n) { n.setAttribute("fill", a); });
      if (head && head.screenText) head.screenText.textContent = state.alert ? "!!" : state.score == null ? "··" : state.level === "red" ? "!!" : String(state.score);
      badge.hidden = !state.alert && state.score == null; badge.textContent = state.alert ? "!" : state.score == null ? "" : String(state.score);
    }

    /* ---------- Fisica ---------- */
    var saved = null;
    try { saved = JSON.parse((opts.storage || localStorage).getItem("rastro_mascot") || "null"); } catch (e) { saved = null; }
    if (saved && VARIANTS.indexOf(saved.variant) >= 0 && !opts.variant) variant = saved.variant;
    // Sin posicion guardada, el robot vive anclado abajo a la derecha (y sigue ahi si cambia la ventana).
    var anchored = !(saved && isFinite(saved.x) && isFinite(saved.y));
    function home() { px = Math.max(12, innerWidth - W - 28); py = Math.max(20, innerHeight - H - 110); }
    var px = 0, py = 0;
    if (anchored) home(); else { px = saved.x; py = saved.y; }
    var vx = 0, vy = 0, pvx = 0, theta = 0, omega = 0, arm = 0, armV = 0, ant = 0, antV = 0, tilt = 0, stretch = 1;
    var dragging = false, moved = 0, grabDX = 0, grabDY = 0, lastT = 0, lastPX = 0, lastPY = 0, blinkAt = performance.now() + 2500, lid = 0;
    var G = 2600, L = 46, DAMP = 4.6, COUPLE = 0.42, MAX_SWING = 0.95;

    function persist() { try { (opts.storage || localStorage).setItem("rastro_mascot", JSON.stringify(anchored ? { variant: variant } : { x: px, y: py, variant: variant })); } catch (e) { /* sin almacenamiento */ } }
    function keepInside() { px = clamp(px, 4, Math.max(4, innerWidth - W - 4)); py = clamp(py, 20, Math.max(20, innerHeight - H - 4)); }

    function step(now) {
      var dt = Math.min(0.033, (now - lastT) / 1000 || 0.016); lastT = now;
      if (!dragging) { vx *= Math.pow(0.0001, dt); vy *= Math.pow(0.0001, dt); }
      var ax = (vx - pvx) / dt; pvx = vx;
      if (!reduced) {
        var alpha = -(G / L) * Math.sin(theta) - DAMP * omega - (ax / L) * Math.cos(theta) * COUPLE;
        omega += alpha * dt; theta = clamp(theta + omega * dt, -MAX_SWING, MAX_SWING); if (Math.abs(theta) === MAX_SWING) omega *= -0.35; // rebote suave en el tope
        var armA = 260 * (theta * 1.7 - arm) - 9 * armV; armV += armA * dt; arm = clamp(arm + armV * dt, -1.5, 1.5);
        var antA = 320 * (-theta * 0.9 - vx * 0.0009 - ant) - 7 * antV; antV += antA * dt; ant = clamp(ant + antV * dt, -0.9, 0.9);
        tilt += (clamp(vx * 0.00045, -0.22, 0.22) - tilt) * Math.min(1, dt * 10);
        stretch += (1 + clamp(vy * 0.00035, -0.1, 0.16) - stretch) * Math.min(1, dt * 12);
      }
      var breathe = reduced ? 0 : Math.sin(now / 900) * 1.2;
      bot.style.transform = "translate3d(" + px + "px," + py + "px,0)";
      headG.setAttribute("transform", "translate(0," + breathe + ") rotate(" + (tilt * 57.3) + " " + NECK_X + " " + NECK_Y + ")");
      bodyG.setAttribute("transform", "translate(0," + breathe + ") rotate(" + (theta * 57.3) + " " + NECK_X + " " + NECK_Y + ") translate(" + NECK_X + " " + NECK_Y + ") scale(" + (2 - stretch) + " " + stretch + ") translate(" + -NECK_X + " " + -NECK_Y + ")");
      body.armL.setAttribute("transform", "rotate(" + ((arm - theta) * 57.3 + 6) + " 32 106)");
      body.armR.setAttribute("transform", "rotate(" + ((arm - theta) * 57.3 - 6) + " 88 106)");
      body.legs.setAttribute("transform", "rotate(" + ((arm - theta) * 22) + " 60 138)");
      if (head.antenna) head.antenna.setAttribute("transform", "rotate(" + (ant * 57.3) + " 60 12)");
      // parpadeo
      if (now > blinkAt) { lid = 1; blinkAt = now + 2200 + Math.random() * 3200; }
      lid = Math.max(0, lid - dt * 7);
      var calm = state.level === "red" ? 0 : state.level === "orange" ? 0.12 : 0.3; // ojos entornados cuando todo va bien
      head.lids.forEach(function (r) { var full = variant === "orbe" ? 64 : variant === "avatar" ? 32 : 34; r.setAttribute("height", String(full * Math.max(lid, dragging ? 0 : calm))); });
      if (!panel.hidden) placePanel();
    }
    function frame(now) { step(now); requestAnimationFrame(frame); }

    function onDown(e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true; moved = 0; bot.classList.add("drag");
      grabDX = e.clientX - px; grabDY = e.clientY - py; lastPX = e.clientX; lastPY = e.clientY;
      try { bot.setPointerCapture(e.pointerId); } catch (err) { /* navegadores antiguos */ }
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var t = performance.now(), dt = Math.max(0.008, (t - (onMove.t || t - 16)) / 1000); onMove.t = t;
      var nx = e.clientX - grabDX, ny = e.clientY - grabDY;
      moved += Math.abs(e.clientX - lastPX) + Math.abs(e.clientY - lastPY); lastPX = e.clientX; lastPY = e.clientY;
      vx = vx * 0.5 + ((nx - px) / dt) * 0.5; vy = vy * 0.5 + ((ny - py) / dt) * 0.5;
      px = nx; py = ny; keepInside();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false; bot.classList.remove("drag");
      if (moved < 6) toggle(); else { anchored = false; persist(); }
    }
    bot.addEventListener("pointerdown", onDown);
    bot.addEventListener("pointermove", onMove);
    bot.addEventListener("pointerup", onUp);
    bot.addEventListener("pointercancel", onUp);
    bot.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } if (e.key === "Escape") { panel.hidden = true; } });
    addEventListener("resize", function () { if (anchored) home(); keepInside(); });

    /* ---------- Burbuja ---------- */
    function placePanel() {
      var pw = Math.min(312, innerWidth - 24), ph = panel.offsetHeight || 260;
      var left = px + W / 2 > innerWidth / 2 ? px - pw - 10 : px + W + 10;
      if (left < 12 || left + pw > innerWidth - 12) left = clamp(px + W / 2 - pw / 2, 12, innerWidth - pw - 12);
      var top = clamp(py + 10, 12, Math.max(12, innerHeight - ph - 12));
      if (left >= px - pw && left <= px + W && top < py + H && top + ph > py) top = py - ph - 10 > 12 ? py - ph - 10 : py + H + 10;
      panel.style.transform = "translate3d(" + left + "px," + top + "px,0)";
    }
    function ring(score, color) {
      var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 54 54"); s.setAttribute("width", 54); s.setAttribute("height", 54); s.style.transform = "rotate(-90deg)";
      var c = 2 * Math.PI * 23;
      el("circle", { cx: 27, cy: 27, r: 23, fill: "none", stroke: "#262626", "stroke-width": 5 }, s);
      el("circle", { cx: 27, cy: 27, r: 23, fill: "none", stroke: color, "stroke-width": 5, "stroke-linecap": "round", "stroke-dasharray": c, "stroke-dashoffset": c * (1 - score / 100) }, s);
      return s;
    }
    function renderPanel() {
      panel.textContent = "";
      if (state.alert) {
        var box = h("div", "alert " + state.alert.level, panel);
        h("p", "alert-title", box, state.alert.title);
        var al = h("ul", "alert-lines", box);
        (state.alert.lines || []).forEach(function (line) { h("li", "", al, line); });
        var aa = h("div", "actions", box);
        (state.alert.actions || []).forEach(function (a) { var b = h("button", a.primary ? "primary" : "", aa, a.label); b.type = "button"; b.addEventListener("click", function () { a.run(api); }); });
      }
      var top = h("div", "head", panel);
      var sc = h("div", "score", top);
      if (state.score != null) { sc.appendChild(ring(state.score, accent())); h("b", "", sc, String(state.score)); } else { sc.appendChild(ring(0, "#262626")); h("b", "", sc, "··"); }
      var tt = h("div", "", top); h("p", "title", tt, labels.title); h("p", "host", tt, state.report ? state.report.siteHost : labels.waiting);
      var ul = h("ul", "lines", panel);
      (state.lines.length ? state.lines : [labels.waiting]).forEach(function (line, i) { var li = h("li", state.report && i >= 2 ? "flag" : "", ul, line); li.setAttribute("dir", "auto"); });
      if (state.report && state.report.companies.length) {
        var chips = h("div", "chips", panel);
        state.report.companies.slice(0, 12).forEach(function (c) { h("span", "chip " + c.category, chips, c.company); });
      }
      var actions = h("div", "actions", panel);
      (opts.actions || []).forEach(function (a) { var b = h("button", a.primary ? "primary" : "", actions, a.label); b.type = "button"; b.addEventListener("click", function () { a.run(api); }); });
      var pick = h("div", "pick", panel);
      VARIANTS.forEach(function (v, i) { var b = h("button", "", pick, labels.robots[i]); b.type = "button"; b.setAttribute("aria-pressed", String(v === variant)); b.addEventListener("click", function () { api.setVariant(v); }); });
      h("p", "foot", panel, labels.privacy);
    }
    function toggle() { panel.hidden = !panel.hidden; if (!panel.hidden) { renderPanel(); placePanel(); } }

    var api = {
      element: host,
      setReport: function (report, lines) { state.report = report; state.lines = lines || []; state.score = report ? report.score : null; state.level = report ? report.level : "idle"; paintState(); if (!panel.hidden) renderPanel(); if (report && report.level === "red" && !reduced) { omega += 9; antV += 14; } },
      setVariant: function (v) { if (VARIANTS.indexOf(v) < 0) return; variant = v; build(); persist(); if (!panel.hidden) renderPanel(); if (opts.onVariant) opts.onVariant(v); },
      /** Aviso de seguridad (web que imita a otra). null lo quita. Abre la burbuja y sacude al robot. */
      alert: function (a) { state.alert = a || null; paintState(); if (a) { panel.hidden = false; renderPanel(); placePanel(); if (!reduced) { omega += 12; antV += 18; } } else if (!panel.hidden) renderPanel(); },
      say: function (lines) { state.lines = lines; panel.hidden = false; renderPanel(); placePanel(); },
      open: function () { if (panel.hidden) toggle(); },
      close: function () { panel.hidden = true; },
      destroy: function () { host.remove(); },
      nudge: function (dx) { vx += dx; },
      /** Avanza un fotograma a mano (pruebas, o pestanas donde rAF esta en pausa). */
      step: function (now) { step(now == null ? performance.now() : now); },
    };
    build(); keepInside();
    (opts.parent || document.documentElement).appendChild(host);
    lastT = performance.now(); step(lastT); // coloca el robot aunque rAF este en pausa (pestana oculta)
    requestAnimationFrame(frame);
    return api;
  }

  globalThis.RastroMascot = { create: create, VARIANTS: VARIANTS };
})();
