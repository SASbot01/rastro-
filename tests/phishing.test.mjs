import test from "node:test";
import assert from "node:assert/strict";
import { assessSite, describeRisk, levenshtein } from "../extensions/guardian/lib/phishing.js";

const level = (host, extra = {}) => assessSite({ host, https: true, ...extra }).level;

test("las webs oficiales y las normales no disparan nada", () => {
  for (const h of ["www.bbva.es", "particulares.bancosantander.es", "www.amazon.es", "sede.agenciatributaria.gob.es", "login.microsoftonline.com", "elmundo.es", "www.marca.com", "applebees.com", "orangetheory.com", "googleusercontent.com", "grange.com", "apple-pie.com", "rastropro.com", "github.com", "accounts.google.com"]) {
    assert.equal(level(h, { hasPassword: true }), "none", h);
  }
});

test("imitaciones claras son peligro aunque no pidan nada", () => {
  for (const h of ["paypa1.com", "santader.com", "caixabnak.es", "rnicrosoft.com", "arnazon.es", "netfiix.com", "xn--mazon-3ve.com", "аmazon.com", "amazon.top"]) {
    const r = assessSite({ host: h, https: true });
    assert.equal(r.level, "danger", h + " -> " + JSON.stringify(r));
    assert.ok(r.brand, h);
  }
});

test("marca como palabra en dominio ajeno: sospechosa con cebo, peligro si pide contraseña", () => {
  assert.equal(level("bbva-clientes.com"), "suspicious");
  assert.equal(level("bbva-clientes.com", { hasPassword: true }), "danger");
  assert.equal(level("correos.paquete-info.top"), "danger");
  assert.equal(level("seguridad-caixabank.net", { hasCard: true }), "danger");
  assert.equal(level("blog-sobre-bbva.com"), "none");
});

test("sin marca solo avisa con señales fuertes combinadas", () => {
  assert.equal(level("mi-tienda.xyz", { hasPassword: true }), "none");
  assert.equal(level("secure-login-verify.account.xyz", { hasPassword: true }), "suspicious");
  assert.equal(assessSite({ host: "foro-antiguo.com", https: false, hasPassword: true }).level, "suspicious");
  assert.equal(assessSite({ host: "85.12.33.4", https: true, hasPassword: true }).level, "suspicious");
  assert.equal(assessSite({ host: "192.168.1.1", https: false, hasPassword: true }).level, "none");
});

test("las frases dicen cual es la web oficial", () => {
  const r = assessSite({ host: "santader.com", https: true, hasPassword: true });
  const d = describeRisk(r, "es");
  assert.match(d.title, /Banco Santander/);
  assert.ok(d.lines.some((l) => l.includes("bancosantander.es")));
  assert.ok(d.lines.some((l) => /contraseña/.test(l)));
  assert.equal(levenshtein("santadner", "santander"), 1);
});
