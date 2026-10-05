import { test } from "node:test";
import assert from "node:assert/strict";
import { previousDay, dayNumber, questIndexForDay, viewState, completeToday } from "../lib/daily-quest-core.ts";

test("previousDay cruza meses y años", () => {
  assert.equal(previousDay("2026-03-01"), "2026-02-28");
  assert.equal(previousDay("2026-01-01"), "2025-12-31");
  assert.equal(previousDay("2026-10-05"), "2026-10-04");
});

test("el reto del día es determinista y estable por fecha", () => {
  assert.equal(questIndexForDay("2026-10-05", 24), dayNumber("2026-10-05") % 24);
  assert.equal(questIndexForDay("2026-10-05", 24), questIndexForDay("2026-10-05", 24));
  // dos días seguidos dan retos distintos (índices consecutivos)
  assert.notEqual(questIndexForDay("2026-10-05", 24), questIndexForDay("2026-10-06", 24));
  // banco vacío no rompe
  assert.equal(questIndexForDay("2026-10-05", 0), 0);
});

test("viewState: racha viva solo si el último fue hoy o ayer", () => {
  assert.deepEqual(viewState(5, 9, "2026-10-05", "2026-10-05", 24), { streak: 5, best: 9, doneToday: true, index: questIndexForDay("2026-10-05", 24) });
  assert.equal(viewState(5, 9, "2026-10-04", "2026-10-05", 24).streak, 5); // ayer → viva, aún no hecho hoy
  assert.equal(viewState(5, 9, "2026-10-04", "2026-10-05", 24).doneToday, false);
  assert.equal(viewState(5, 9, "2026-10-02", "2026-10-05", 24).streak, 0); // hueco → rota
});

test("completeToday suma, reinicia y es idempotente", () => {
  // primer reto
  assert.deepEqual(completeToday(0, 0, null, "2026-10-05"), { streak: 1, best: 1, already: false, last: "2026-10-05" });
  // ayer hecho → +1
  assert.deepEqual(completeToday(3, 7, "2026-10-04", "2026-10-05"), { streak: 4, best: 7, already: false, last: "2026-10-05" });
  // nuevo récord
  assert.equal(completeToday(7, 7, "2026-10-04", "2026-10-05").best, 8);
  // hueco → reinicia en 1
  assert.deepEqual(completeToday(10, 10, "2026-10-01", "2026-10-05"), { streak: 1, best: 10, already: false, last: "2026-10-05" });
  // ya hecho hoy → no cambia
  assert.deepEqual(completeToday(4, 9, "2026-10-05", "2026-10-05"), { streak: 4, best: 9, already: true, last: "2026-10-05" });
});
