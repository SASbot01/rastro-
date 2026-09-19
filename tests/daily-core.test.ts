import test from "node:test";
import assert from "node:assert/strict";
import { dailyOutcome } from "../lib/daily-core.ts";

const base = { names: ["Adobe", "LinkedIn"], pastes: 3, knownNames: ["Adobe", "LinkedIn"], prevBreaches: 2, knownPastes: 3, reportChecked: true };

test("sin novedades no hay aviso, y una filtracion o un volcado nuevos si", () => {
  assert.deepEqual(dailyOutcome(base), { newBreaches: [], newPastes: 0, pastesToStore: 3 });
  assert.deepEqual(dailyOutcome({ ...base, names: ["Wattpad", "Adobe", "LinkedIn"], pastes: 4 }), { newBreaches: ["Wattpad"], newPastes: 1, pastesToStore: 4 });
});

test("un dia sin poder mirar los volcados no es '0 volcados': al dia siguiente no salen todos como nuevos", () => {
  const failed = dailyOutcome({ ...base, pastes: null });
  assert.deepEqual(failed, { newBreaches: [], newPastes: 0, pastesToStore: 3 }); // antes se guardaba 0
  const nextDay = dailyOutcome({ ...base, pastes: 3, knownPastes: failed.pastesToStore });
  assert.equal(nextDay.newPastes, 0); // antes: 3 "volcados nuevos" y un correo de alerta en falso
});

test("sin nada con que comparar, la primera comprobacion es la linea base (sin aviso)", () => {
  const first = dailyOutcome({ names: ["Adobe", "LinkedIn", "Canva"], pastes: 2, knownNames: [], prevBreaches: null, knownPastes: null, reportChecked: false });
  assert.deepEqual(first, { newBreaches: [], newPastes: 0, pastesToStore: 2 });
  // Con un informe que si miro HIBP, lo que no estaba en el informe es nuevo.
  assert.deepEqual(dailyOutcome({ ...base, names: ["Canva", "Adobe", "LinkedIn"], prevBreaches: null }).newBreaches, ["Canva"]);
});

test("con una comprobacion anterior, como mucho hay tantas filtraciones nuevas como haya crecido el total", () => {
  // La lista de nombres conocidos esta incompleta (el informe no pudo mirar HIBP), pero el total de ayer era 3.
  const r = dailyOutcome({ names: ["Adobe", "LinkedIn", "Canva"], pastes: 0, knownNames: [], prevBreaches: 3, knownPastes: 0, reportChecked: false });
  assert.deepEqual(r.newBreaches, []);
  assert.deepEqual(dailyOutcome({ names: ["Wattpad", "Adobe", "LinkedIn", "Canva"], pastes: 0, knownNames: [], prevBreaches: 3, knownPastes: 0, reportChecked: false }).newBreaches, ["Wattpad"]);
});
