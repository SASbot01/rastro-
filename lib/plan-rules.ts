// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * ¿Puede esta cuenta entrar como miembro en el plan familiar de `ownerId`?
 *
 * Entrar en una familia sobrescribe plan, plan_until, plan_kind y
 * family_owner_id de la cuenta invitada, y al quitarla se queda en 'free'.
 * Por eso nunca se toca una cuenta que ya tiene su propio plan: ni quien paga
 * (individual, familiar o de equipo), ni el titular de otra familia o de una
 * empresa, ni quien ya es miembro de una empresa o de otra familia. Antes solo
 * se protegia el plan 'individual': un titular familiar podia invitar y quitar
 * a OTRO cliente de pago (familiar o equipo) y dejarlo sin Pro.
 */
export interface JoinCandidate {
  id: string;
  plan: string;
  plan_until: string | null;
  plan_kind: string;
  stripe_customer_id: string | null;
  family_owner_id: string | null;
  org_id: string | null;
}

export function canJoinFamily(member: JoinCandidate, ownerId: string, now = Date.now()): boolean {
  if (member.id === ownerId) return false;
  const pro = member.plan === "pro" && (!member.plan_until || new Date(member.plan_until).getTime() > now);
  if (pro && member.stripe_customer_id) return false; // paga su propio plan, del tipo que sea
  if (pro && (member.plan_kind === "family" || member.plan_kind === "team")) return false; // titular en activo de otra familia o de una empresa (aunque su Pro no venga de Stripe)
  if (member.org_id) return false; // su Pro viene de una empresa
  if (member.family_owner_id && member.family_owner_id !== ownerId) return false; // ya esta en otra familia
  return true;
}
