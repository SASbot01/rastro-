import test from "node:test";
import assert from "node:assert/strict";
import { ilikeExact } from "../lib/like-escape.ts";

/** ILIKE de Postgres en miniatura: "_" = un caracter, "%" = cualquier cadena, "\" escapa. */
function ilike(text: string, pattern: string): boolean {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "_") re += ".";
    else if (c === "%") re += ".*";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i").test(text);
}

test("sin escapar, el correo de otra persona coincide (el fallo que se corrige)", () => {
  assert.equal(ilike("ana.garcia@gmail.com", "ana_garcia@gmail.com"), true);
});

test("el patron escapado solo encuentra el mismo correo, sin distinguir mayusculas", () => {
  const p = ilikeExact("ana_garcia@gmail.com");
  assert.equal(p, "ana\\_garcia@gmail.com");
  assert.equal(ilike("ana.garcia@gmail.com", p), false);
  assert.equal(ilike("anaXgarcia@gmail.com", p), false);
  assert.equal(ilike("Ana_Garcia@Gmail.com", p), true);
  assert.equal(ilike("cualquiera@gmail.com", ilikeExact("%@gmail.com")), false);
  assert.equal(ilikeExact("a\\b"), "a\\\\b");
});
