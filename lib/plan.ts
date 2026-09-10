import type { UserRow } from "@/lib/users";

/**
 * Plan Pro (semana 2). `plan` lo pone el webhook de Stripe; `plan_until`
 * es el fin del periodo pagado. Al cancelar, Pro sigue activo hasta esa
 * fecha y luego el webhook (o esta comprobacion) lo deja en free.
 */
export function isPro(user: Pick<UserRow, "plan" | "plan_until"> | null | undefined): boolean {
  if (!user || user.plan !== "pro") return false;
  return !user.plan_until || new Date(user.plan_until).getTime() > Date.now();
}

/** Enlaces de pago de Stripe con el correo (y la cuenta) ya rellenados. */
export function paymentLinks(email?: string | null, userId?: string | null): { monthly: string | null; yearly: string | null } {
  const decorate = (base: string | undefined) => {
    if (!base) return null;
    const url = new URL(base);
    if (email) url.searchParams.set("prefilled_email", email);
    if (userId) url.searchParams.set("client_reference_id", userId);
    return url.toString();
  };
  return { monthly: decorate(process.env.STRIPE_LINK_MONTHLY), yearly: decorate(process.env.STRIPE_LINK_YEARLY) };
}
