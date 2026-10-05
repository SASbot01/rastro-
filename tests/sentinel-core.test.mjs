import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSentinelEvent, isNotifiable } from "../lib/sentinel-core.ts";

test("kind es obligatorio", () => {
  assert.equal(normalizeSentinelEvent({}), null);
  assert.equal(normalizeSentinelEvent({ kind: "   " }), null);
  assert.equal(normalizeSentinelEvent({ severity: "critical" }), null);
});

test("normaliza kind y aplica gravedad por defecto", () => {
  const ev = normalizeSentinelEvent({ kind: "Login Failed" });
  assert.equal(ev.kind, "login_failed");
  assert.equal(ev.severity, "info");
  assert.equal(ev.actor, null);
});

test("gravedad invalida cae a info; valida se respeta", () => {
  assert.equal(normalizeSentinelEvent({ kind: "x", severity: "boom" }).severity, "info");
  assert.equal(normalizeSentinelEvent({ kind: "x", severity: "critical" }).severity, "critical");
});

test("recorta cadenas y descarta meta demasiado grande", () => {
  const ev = normalizeSentinelEvent({
    kind: "export_bulk",
    actor: "a".repeat(500),
    message: "m".repeat(999),
    meta: { blob: "z".repeat(5000) },
  });
  assert.equal(ev.actor.length, 200);
  assert.equal(ev.message.length, 500);
  assert.equal(ev.meta, null); // supera 4000 bytes → se descarta
});

test("meta pequeña se conserva", () => {
  const ev = normalizeSentinelEvent({ kind: "x", meta: { count: 7 } });
  assert.deepEqual(ev.meta, { count: 7 });
});

test("solo los criticos avisan", () => {
  assert.equal(isNotifiable({ severity: "critical" }), true);
  assert.equal(isNotifiable({ severity: "warn" }), false);
  assert.equal(isNotifiable({ severity: "info" }), false);
});
