import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidTag, displayName, cleanText, validateThread, validateReply, TITLE_MAX, BODY_MAX } from "../lib/forum-core.ts";

test("tags válidos", () => {
  assert.equal(isValidTag("estafas"), true);
  assert.equal(isValidTag("general"), true);
  assert.equal(isValidTag("hacking"), false);
  assert.equal(isValidTag(null), false);
});

test("displayName nunca enseña el correo entero", () => {
  assert.equal(displayName({ display_name: "Ana", email: "ana@x.com" }), "Ana");
  assert.equal(displayName({ display_name: null, email: "ana.perez@x.com" }), "ana.perez");
  assert.equal(displayName({ display_name: "   ", email: "ana@x.com" }), "ana");
});

test("cleanText quita controles, recorta y colapsa saltos", () => {
  assert.equal(cleanText("  hola  ", 100), "hola");
  assert.equal(cleanText("a\u0000b", 100), "ab");
  assert.equal(cleanText("a\n\n\n\n\nb", 100), "a\n\nb");
  assert.equal(cleanText("x".repeat(50), 10).length, 10);
  assert.equal(cleanText(123, 100), "");
});

test("validateThread exige título y cuerpo, normaliza tag", () => {
  assert.deepEqual(validateThread({ title: "Hola comunidad", body: "¿Qué tal?", tag: "estafas" }), { ok: true, title: "Hola comunidad", body: "¿Qué tal?", tag: "estafas" });
  assert.equal(validateThread({ title: "ab", body: "x" }).ok, false); // título corto
  assert.equal(validateThread({ title: "válido título", body: "" }).ok, false); // sin cuerpo
  assert.equal(validateThread({ title: "válido título", body: "hola", tag: "inventado" }).tag, "general"); // tag malo → general
  assert.equal(validateThread({ title: "x".repeat(TITLE_MAX + 5), body: "hola" }).error, "title_long");
});

test("validateReply exige cuerpo y recorta al máximo", () => {
  assert.equal(validateReply({ body: "  " }).ok, false);
  assert.equal(validateReply({ body: "gracias" }).ok, true);
  assert.equal(validateReply({ body: "y".repeat(BODY_MAX + 100) }).body.length, BODY_MAX);
});
