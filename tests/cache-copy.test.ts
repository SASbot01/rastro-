import test from "node:test";
import assert from "node:assert/strict";
import { copyForCache } from "../lib/report/cache-copy.ts";

test("la copia de cache es un informe completo: sitios comprobados y respuestas crudas incluidos", () => {
  const source = {
    request_id: "orig",
    score: 61,
    summary: "s",
    findings: [{ title: "t" }],
    actions: [],
    breakdown: { publicProfile: -6 },
    accounts: [],
    site_checks: [{ slug: "dateas", host: "dateas.com", status: "listed", url: "https://dateas.com/x" }],
    generator: "ai",
    raw: {
      hibp: { checked: true, breaches: [] },
      brave: { ok: true, hits: [{ url: "https://dateas.com/x", hostname: "dateas.com", kind: "broker" }] },
      perplexity: { answers: [{ key: "who", answer: "Ana es enfermera" }] },
      ai: { attributed_profile_urls: ["https://linkedin.com/in/ana"], signals: { knows_employer: true } },
      diff: { changed: true },
    },
  };
  const copy = copyForCache(source, "nuevo") as typeof source & { raw: Record<string, unknown> };
  assert.equal(copy.request_id, "nuevo");
  assert.deepEqual(copy.site_checks, source.site_checks);
  assert.equal(copy.score, 61);
  // Lo que usa la vigilancia mensual para comparar y la pagina del informe para enseñar lo que dice cada IA:
  assert.deepEqual(copy.raw.brave, source.raw.brave);
  assert.deepEqual(copy.raw.ai, source.raw.ai);
  assert.deepEqual(copy.raw.perplexity, source.raw.perplexity);
  assert.deepEqual(copy.raw.hibp, source.raw.hibp);
  assert.equal(copy.raw.cached_from, "orig");
  assert.equal("diff" in copy.raw, false);
  // No se toca el original.
  assert.equal(source.request_id, "orig");
  assert.equal("cached_from" in source.raw, false);
});

test("un original sin raw no rompe la copia", () => {
  const copy = copyForCache({ request_id: "orig", raw: null, score: 80 }, "nuevo") as { raw: Record<string, unknown> };
  assert.deepEqual(copy.raw, { cached_from: "orig" });
});
