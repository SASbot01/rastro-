import test from "node:test";
import assert from "node:assert/strict";
import { dueStep } from "../lib/nurture-core.ts";

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n, 12));
test("los tres correos salen a los dias 1, 3 y 7 y nunca dos a la vez", () => {
  assert.equal(dueStep(day(0), 0, day(0)), null);
  assert.equal(dueStep(day(0), 0, day(1)), 1);
  assert.equal(dueStep(day(0), 1, day(2)), null);
  assert.equal(dueStep(day(0), 1, day(3)), 2);
  assert.equal(dueStep(day(0), 2, day(30)), 3);
  assert.equal(dueStep(day(0), 3, day(30)), null);
});
