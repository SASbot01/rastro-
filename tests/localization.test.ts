import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
function flatten(value: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const path = `${prefix}${key}`;
    return typeof item === "string" ? [[path, item]] : Object.entries(flatten(item as Record<string, unknown>, `${path}.`));
  }));
}
test("experience ES/EN copy has identical keys and interpolation arguments", () => {
  const es = flatten(read("../messages/es.json").experience);
  const en = flatten(read("../messages/en.json").experience);
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(es)) {
    assert.ok(en[key].trim(),key);
    assert.deepEqual((value.match(/\{\w+\}/g) ?? []).sort(), (en[key].match(/\{\w+\}/g) ?? []).sort(),key);
  }
});
test("extension has matching translations, minimal permissions and makes no network calls", () => {
  assert.deepEqual(Object.keys(read("../extensions/guardian/_locales/es/messages.json")).sort(), Object.keys(read("../extensions/guardian/_locales/en/messages.json")).sort());
  const manifest = read("../extensions/guardian/manifest.json");
  assert.equal(manifest.manifest_version, 3);
  // El robot de cookies necesita leer cookies y dibujarse en las paginas; nada mas.
  assert.deepEqual([...manifest.permissions].sort(), ["cookies", "declarativeNetRequestWithHostAccess", "storage"]);
  for (const forbidden of ["history", "webRequest", "tabs", "bookmarks", "downloads", "nativeMessaging"]) assert.ok(!manifest.permissions.includes(forbidden), forbidden);
  // El bloqueo de rastreadores viene apagado y solo usa reglas estaticas incluidas en el paquete.
  assert.equal(manifest.declarative_net_request.rule_resources[0].enabled, false);
  // Privacidad: la extension no habla con ningun servidor.
  for (const file of ["background.js", "content.js", "mascot.js", "popup.js", "lib/analyze.js", "lib/trackers.js", "lib/phishing.js", "lib/brands.js"]) {
    const source = readFileSync(new URL(`../extensions/guardian/${file}`, import.meta.url), "utf8");
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(source), `${file} hace llamadas de red`);
    assert.ok(!/\.value\b/.test(source.replace(/e\.target\.value|n\.value|\$\("variant"\)\.value/g, "")), `${file} lee valores de cookies`);
  }
});
