import test from "node:test";
import assert from "node:assert/strict";
import { canJoinFamily, type JoinCandidate } from "../lib/plan-rules.ts";

const NOW = Date.parse("2026-09-19T00:00:00Z");
const U = (o: Partial<JoinCandidate>): JoinCandidate => ({ id: "m", plan: "free", plan_until: null, plan_kind: "individual", stripe_customer_id: null, family_owner_id: null, org_id: null, ...o });

test("una cuenta gratuita (o un antiguo cliente ya sin Pro) puede entrar en la familia", () => {
  assert.equal(canJoinFamily(U({}), "owner", NOW), true);
  assert.equal(canJoinFamily(U({ plan: "pro", plan_until: "2026-01-01T00:00:00Z", stripe_customer_id: "cus_1" }), "owner", NOW), true);
  assert.equal(canJoinFamily(U({ plan: "pro", plan_kind: "member", family_owner_id: "owner" }), "owner", NOW), true); // ya es de esta familia: idempotente
});

test("nunca se pisa a quien ya tiene su propio plan, sea del tipo que sea", () => {
  const paying = { plan: "pro", plan_until: "2027-01-01T00:00:00Z", stripe_customer_id: "cus_1" };
  assert.equal(canJoinFamily(U({ ...paying, plan_kind: "individual" }), "owner", NOW), false);
  // El fallo: antes estos dos pasaban, quedaban como 'member' y al quitarlos se quedaban en 'free' pagando.
  assert.equal(canJoinFamily(U({ ...paying, plan_kind: "family" }), "owner", NOW), false);
  assert.equal(canJoinFamily(U({ ...paying, plan_kind: "team", org_id: "org1" }), "owner", NOW), false);
  assert.equal(canJoinFamily(U({ plan: "pro", plan_kind: "family" }), "owner", NOW), false); // titular con Pro concedido a mano
});

test("miembros de una empresa o de otra familia, y uno mismo, tampoco", () => {
  assert.equal(canJoinFamily(U({ plan: "pro", plan_kind: "member", org_id: "org1" }), "owner", NOW), false);
  assert.equal(canJoinFamily(U({ plan: "pro", plan_kind: "member", family_owner_id: "otra" }), "owner", NOW), false);
  assert.equal(canJoinFamily(U({ id: "owner" }), "owner", NOW), false);
});
