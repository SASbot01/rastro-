import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  detectCms, detectCookieBanner, detectTrackers, evaluateHeaders, extractEmails, generateLookalikes, isGenericLocal, linkedinSummary,
  likelyOwned, mailProviderFor, maskEmail, normalizeDomain, parseDmarc, parseSpf, plainAnswer, recommendationsFor, registrableDomain, scoreDomain, summarizeEmails, thirdPartyHosts,
  type DomainScoreSignals,
} from "../lib/domain-report-core.ts";
import { TRACKER_DOMAINS } from "../extensions/guardian/lib/trackers.js";

const OK: DomainScoreSignals = { spf: "hard", dmarc: "reject", dkim: true, reachable: true, https: true, hsts: true, csp: true, versionLeak: false, lookalikesRegistered: 0, trackers: 0, personalEmails: 0 };

test("normaliza y valida dominios: acepta URL con www, rechaza IP, sin punto o con guion inicial", () => {
  assert.equal(normalizeDomain(" https://www.Clinica-Ejemplo.es/contacto?x=1 "), "clinica-ejemplo.es");
  assert.equal(normalizeDomain("mapfre.es."), "mapfre.es");
  assert.equal(normalizeDomain("localhost"), null);
  assert.equal(normalizeDomain("-mal.es"), null);
  assert.equal(normalizeDomain("192.168.1.1"), null);
  assert.equal(normalizeDomain("a.b"), null);
  assert.equal(normalizeDomain("ana@empresa.es"), null);
  assert.equal(registrableDomain("tienda.empresa.co.uk"), "empresa.co.uk");
  assert.equal(registrableDomain("www.empresa.es"), "empresa.es");
});

test("SPF y DMARC se leen del TXT: -all duro, ~all blando, p=none no protege", () => {
  assert.deepEqual(parseSpf(["v=spf1 include:_spf.google.com -all"]).mode, "hard");
  assert.deepEqual(parseSpf(["otra cosa", "v=spf1 include:spf.protection.outlook.com ~all"]).mode, "soft");
  assert.deepEqual(parseSpf(["v=spf1 include:x.com"]).mode, "open");
  assert.deepEqual(parseSpf([]).mode, "missing");
  assert.equal(parseDmarc(["v=DMARC1; p=quarantine; rua=mailto:d@x.es"]).policy, "quarantine");
  assert.equal(parseDmarc(["v=DMARC1;p=REJECT"]).policy, "reject");
  assert.equal(parseDmarc(["v=DMARC1; rua=mailto:d@x.es"]).policy, "none");
  assert.equal(parseDmarc([]).policy, "missing");
  assert.equal(mailProviderFor(["aspmx.l.google.com"]), "google");
  assert.equal(mailProviderFor(["empresa-es.mail.protection.outlook.com"]), "microsoft");
  assert.equal(mailProviderFor(["mx1.mail.ovh.net"]), "ovh");
  assert.equal(mailProviderFor(["mx00.ionos.es"]), "ionos");
  assert.equal(mailProviderFor([]), "none");
});

test("los dominios parecidos son validos, distintos del original y mezclan terminaciones, sufijos y erratas", () => {
  const list = generateLookalikes("clinicadental.es");
  assert.ok(list.length >= 10 && list.length <= 14, String(list.length));
  assert.ok(list.every((l) => l.domain !== "clinicadental.es"));
  assert.equal(new Set(list.map((l) => l.domain)).size, list.length);
  assert.ok(list.some((l) => l.domain === "clinicadental.com" && l.kind === "tld"));
  assert.ok(list.some((l) => l.domain === "clinicadental-clientes.es" && l.kind === "suffix"));
  assert.ok(list.some((l) => l.kind === "typo"));
});

test("un dominio parecido es 'vuestro' si comparte NS, sus NS llevan el nombre o apunta a la misma IP", () => {
  const own = { domain: "mapfre.es", ownNs: ["esdns1.mapfre.net"], ownA: ["195.53.217.36"] };
  assert.equal(likelyOwned({ ...own, ns: ["esdns1.mapfre.com"], a: ["54.1.1.1"] }), true);
  assert.equal(likelyOwned({ ...own, ns: ["esdns1.mapfre.net"], a: [] }), true);
  assert.equal(likelyOwned({ ...own, ns: ["ns1.hostinger.com"], a: ["195.53.217.36"] }), true);
  assert.equal(likelyOwned({ ...own, ns: ["ns1.hostinger.com"], a: ["1.2.3.4"] }), false);
  assert.equal(plainAnswer("**MAPFRE** es una aseguradora.[1]  \n## Sede\n- Madrid"), "MAPFRE es una aseguradora.[1]\nSede\n· Madrid");
});

test("los correos se extraen solo del dominio, se clasifican y se tapan; nunca sale la direccion entera", () => {
  const text = "Escribe a Info@Empresa.es o a ana.garcia@empresa.es. No a pepe@otraempresa.es ni a x@empresa.es.com";
  const found = extractEmails(text, "empresa.es");
  assert.deepEqual(found.sort(), ["ana.garcia@empresa.es", "info@empresa.es"]);
  assert.equal(maskEmail("ana.garcia@empresa.es"), "an***@empresa.es");
  assert.equal(maskEmail("a@empresa.es"), "a***@empresa.es");
  assert.equal(isGenericLocal("info"), true);
  assert.equal(isGenericLocal("contacto2"), true);
  assert.equal(isGenericLocal("ana.garcia"), false);
  const s = summarizeEmails(found);
  assert.deepEqual([s.total, s.personal, s.generic], [2, 1, 1]);
  assert.ok(s.masked.every((m) => m.includes("***@")));
});

test("cabeceras: detecta HSTS/CSP/X-Frame y la fuga de version en Server", () => {
  const h = new Headers({ server: "Apache/2.4.29 (Ubuntu)", "strict-transport-security": "max-age=31536000", "x-content-type-options": "nosniff" });
  const r = evaluateHeaders(h);
  assert.equal(r.hsts, true);
  assert.equal(r.csp, false);
  assert.equal(r.xContentType, true);
  assert.equal(r.versionLeak, true);
  assert.equal(evaluateHeaders(new Headers({ server: "cloudflare" })).versionLeak, false);
});

test("rastreadores: hosts de terceros agrupados por empresa con la lista de la extension; las CDN no cuentan", () => {
  const html = `<script src="https://www.googletagmanager.com/gtag/js"></script><img src="//www.facebook.com/tr?id=1">
    <script src="https://fonts.gstatic.com/x.js"></script><script src="/js/propio.js"></script><iframe src="https://static.hotjar.com/c.html"></iframe>
    <link href="https://cdn.empresa.es/estilo.css">`;
  const hosts = thirdPartyHosts(html, "empresa.es");
  assert.ok(!hosts.includes("cdn.empresa.es"));
  const trackers = detectTrackers(hosts, TRACKER_DOMAINS);
  assert.deepEqual(trackers.map((t) => t.company).sort(), ["Google", "Hotjar", "Meta"]);
  assert.equal(detectCookieBanner('<script src="https://cdn.cookielaw.org/x.js">'), "OneTrust");
  assert.equal(detectCookieBanner("<div>hola</div>"), null);
  assert.deepEqual(detectCms('<meta name="generator" content="WordPress 5.8.1">'), { cms: "WordPress", version: "5.8.1" });
  assert.deepEqual(detectCms('<link href="/wp-content/themes/x.css">'), { cms: "WordPress", version: null });
});

test("la nota es determinista y sigue la tabla: sin DMARC -20, sin HTTPS -20, parecidos tope -20", () => {
  assert.equal(scoreDomain(OK).score, 100);
  assert.equal(scoreDomain({ ...OK, dmarc: "missing" }).score, 80);
  assert.equal(scoreDomain({ ...OK, dmarc: "none" }).score, 90);
  assert.equal(scoreDomain({ ...OK, spf: "missing" }).score, 90);
  assert.equal(scoreDomain({ ...OK, spf: "soft" }).score, 95);
  assert.equal(scoreDomain({ ...OK, https: false, hsts: false, csp: false }).score, 80);
  assert.equal(scoreDomain({ ...OK, hsts: false }).score, 95);
  assert.equal(scoreDomain({ ...OK, csp: false }).score, 97);
  assert.equal(scoreDomain({ ...OK, lookalikesRegistered: 7 }).breakdown.lookalikes, -20);
  assert.equal(scoreDomain({ ...OK, trackers: 5, personalEmails: 3, versionLeak: true, dkim: false }).score, 80);
  const worst = scoreDomain({ spf: "missing", dmarc: "missing", dkim: false, reachable: true, https: false, hsts: false, csp: false, versionLeak: true, lookalikesRegistered: 4, trackers: 9, personalEmails: 9 });
  assert.equal(worst.score, 10);
  assert.equal(worst.level, "red");
  assert.equal(scoreDomain({ ...OK, dmarc: "missing", https: false }).level, "orange");
});

test("las recomendaciones van por impacto y siempre son tres", () => {
  const r = recommendationsFor({ ...OK, dmarc: "missing", spf: "soft", lookalikesRegistered: 1 }, "google");
  assert.deepEqual(r.map((x) => x.key), ["dmarc_missing", "spf_soft", "lookalikes"]);
  assert.equal(r[0].provider, "google");
  assert.deepEqual(recommendationsFor(OK, "other").map((x) => x.key), ["mfa", "passwords", "access_review"]);
  assert.deepEqual(recommendationsFor({ ...OK, dmarc: "quarantine" }, "other").map((x) => x.key), ["dmarc_quarantine", "mfa", "passwords"]);
});

test("el resumen para LinkedIn lleva dominio, nota, tres acciones y enlace", () => {
  const text = linkedinSummary({ domain: "empresa.es", score: 55, recommendations: ["A", "B", "C", "D"], url: "https://rastropro.com/equipos/informe/empresa.es", lines: { title: "Informe de {domain}: {score}/100", actions: "Acciones:", footer: "Ver:" } });
  const lines = text.split("\n");
  assert.equal(lines.length, 6);
  assert.equal(lines[0], "Informe de empresa.es: 55/100");
  assert.equal(lines[2], "1. A");
  assert.ok(lines[5].endsWith("/empresa.es"));
});

test("las traducciones del informe de dominio tienen las mismas claves y variables en ES y EN", () => {
  const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")) as Record<string, unknown>;
  const flatten = (value: Record<string, unknown>, prefix = ""): Record<string, string> => Object.fromEntries(Object.entries(value).flatMap(([k, v]) => (typeof v === "string" ? [[`${prefix}${k}`, v]] : Object.entries(flatten(v as Record<string, unknown>, `${prefix}${k}.`)))));
  const es = flatten(read("../messages/es.json").domainReport as Record<string, unknown>);
  const en = flatten(read("../messages/en.json").domainReport as Record<string, unknown>);
  assert.ok(Object.keys(es).length > 40);
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(es)) {
    assert.ok(en[key].trim(), key);
    assert.deepEqual((value.match(/\{\w+\}/g) ?? []).sort(), (en[key].match(/\{\w+\}/g) ?? []).sort(), key);
    assert.ok(!/\bborra(r|mos)\b/i.test(value), `promesa de borrar en ${key}`);
  }
});
