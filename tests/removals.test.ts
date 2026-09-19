import test from "node:test";
import assert from "node:assert/strict";
import { applyCheck, computeRemovalStats, actionableHosts, type RemovalLetter } from "../lib/removal-stats.ts";

const L = (o: Partial<RemovalLetter>): RemovalLetter => ({ id: "x", host: "a.com", status: "sent", outcome: null, still_listed: null, removed_at: null, deadline_at: null, ...o });

test("el contador cuenta por sitio y une hallazgos con cartas", () => {
  const now = new Date("2026-09-19T00:00:00Z");
  const s = computeRemovalStats([
    L({ host: "www.a.com", removed_at: "2026-09-10T00:00:00Z" }),
    L({ host: "b.com", deadline_at: "2026-09-01T00:00:00Z" }),
    L({ host: "c.com", deadline_at: "2026-10-01T00:00:00Z" }),
    L({ host: "d.com", outcome: "refused" }),
    L({ host: "e.com", status: "draft" }),
  ], ["a.com", "f.com", "e.com"], now);
  assert.deepEqual(s, { found: 6, requested: 4, removed: 1, pending: 1, overdue: 1, refused: 1, percent: 17 });
});

test("un sitio con dos cartas solo cuenta como retirado si lo estan las dos", () => {
  const s = computeRemovalStats([L({ removed_at: "2026-09-10T00:00:00Z" }), L({})], []);
  assert.equal(s.removed, 0);
  assert.equal(s.pending, 1);
});

test("no se canta victoria en falso: sin haberlo visto antes, no aparecer no es retirada", () => {
  const base = { still_listed: null, removed_at: null, check_count: 0, events: [] };
  assert.equal(applyCheck(base, { listed: false, httpGone: false }).justRemoved, false);
  assert.equal(applyCheck({ ...base, still_listed: true }, { listed: false, httpGone: false }).justRemoved, true);
  assert.equal(applyCheck(base, { listed: false, httpGone: true }).justRemoved, true);
});

test("un fallo de lectura no pisa el resultado anterior y una reaparicion reabre", () => {
  const seen = { still_listed: true, removed_at: null, check_count: 2, events: [] };
  const unknown = applyCheck(seen, { listed: null, httpGone: false });
  assert.equal("still_listed" in unknown.patch, false);
  assert.equal(unknown.patch.check_count, 3);
  const back = applyCheck({ ...seen, still_listed: false, removed_at: "2026-09-01T00:00:00Z" }, { listed: true, httpGone: false });
  assert.equal(back.reappeared, true);
  assert.equal(back.patch.removed_at, null);
});

test("las filtraciones no son sitios a los que pedir retirada", () => {
  assert.deepEqual(actionableHosts([{ category: "breaches", source_url: "https://x.com/a" }, { category: "profiles", source_url: "https://www.y.com/p" }, { category: "ai", source_url: null }]), ["y.com"]);
});
