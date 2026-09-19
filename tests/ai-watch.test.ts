import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FACTS, diffFacts, knowledgeLevel, sameFact, worthAlert, type AiFacts } from "../lib/ai-watch-core.ts";

const F = (o: Partial<AiFacts>): AiFacts => ({ ...EMPTY_FACTS, knows_you: true, ...o });

test("la misma empresa con otra redaccion no es un cambio", () => {
  assert.equal(sameFact("Hospital La Fe", "el Hospital Universitario La Fe de Valencia"), true);
  assert.equal(sameFact("Hospital La Fe", "Mercadona"), false);
  assert.deepEqual(diffFacts({ perplexity: F({ employer: "Hospital La Fe" }) }, { perplexity: F({ employer: "Hospital Universitari i Politècnic La Fe" }) }), []);
});

test("una IA que aprende donde trabajas y tu telefono dispara aviso", () => {
  const changes = diffFacts({ openai: F({}) }, { openai: F({ employer: "Acme", contact: ["phone"] }) });
  assert.deepEqual(changes.map((c) => c.kind), ["employer_new", "contact_new"]);
  assert.equal(worthAlert(changes), true);
  assert.equal(changes.every((c) => c.worse), true);
});

test("afirmaciones nuevas son cambios menores y no avisan solas", () => {
  const changes = diffFacts({ gemini: F({ claims: ["Corrio la maraton de Valencia"] }) }, { gemini: F({ claims: ["Corrió la Maratón de Valencia", "Publicó un libro en 2024"] }) });
  assert.deepEqual(changes.map((c) => [c.kind, c.after, c.minor]), [["claim_new", "Publicó un libro en 2024", true]]);
  assert.equal(worthAlert(changes), false);
});

test("sin foto anterior de esa IA no hay con que comparar", () => {
  assert.deepEqual(diffFacts({ perplexity: F({}) }, { perplexity: F({}), openai: F({ employer: "Acme" }) }), []);
  assert.deepEqual(diffFacts(null, { openai: F({ employer: "Acme" }) }), []);
});

test("olvidarte es una buena noticia", () => {
  const [c] = diffFacts({ perplexity: F({}) }, { perplexity: { ...EMPTY_FACTS } });
  assert.equal(c.kind, "forgot_you");
  assert.equal(c.worse, false);
  assert.equal(knowledgeLevel({ ...EMPTY_FACTS }), 0);
  assert.ok(knowledgeLevel(F({ employer: "x", city: "y", contact: ["phone", "email"] })) > 80);
});
