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
/** Plazas del plan familiar (titular incluido). */
export const FAMILY_SEATS = Number(process.env.NEXT_PUBLIC_FAMILY_SEATS || 3);

/** Precios mostrados (texto). Se cambian por variables de entorno sin tocar codigo; deben coincidir con Stripe. */
export function prices(): { monthly: string; yearly: string; familyMonthly: string; familyYearly: string } {
  return {
    monthly: process.env.NEXT_PUBLIC_PRICE_MONTHLY || "19 €",
    yearly: process.env.NEXT_PUBLIC_PRICE_YEARLY || "99 €",
    familyMonthly: process.env.NEXT_PUBLIC_PRICE_FAMILY_MONTHLY || "29 €",
    familyYearly: process.env.NEXT_PUBLIC_PRICE_FAMILY_YEARLY || "149 €",
  };
}

export function paymentLinks(email?: string | null, userId?: string | null): { monthly: string | null; yearly: string | null; familyMonthly: string | null; familyYearly: string | null } {
  const decorate = (base: string | undefined) => {
    if (!base) return null;
    const url = new URL(base);
    if (email) url.searchParams.set("prefilled_email", email);
    if (userId) url.searchParams.set("client_reference_id", userId);
    return url.toString();
  };
  return {
    monthly: decorate(process.env.STRIPE_LINK_MONTHLY),
    yearly: decorate(process.env.STRIPE_LINK_YEARLY),
    familyMonthly: decorate(process.env.STRIPE_LINK_FAMILY_MONTHLY),
    familyYearly: decorate(process.env.STRIPE_LINK_FAMILY_YEARLY),
  };
}


/** Rastro Equipos (v5): plazas y precios por variables de entorno. */
export const TEAM_SEATS = Number(process.env.NEXT_PUBLIC_TEAM_SEATS || 10);
export function teamPrices(): { small: string; smallSeats: number; large: string; largeSeats: number } {
  return {
    small: process.env.NEXT_PUBLIC_PRICE_TEAM_SMALL || "149 €",
    smallSeats: Number(process.env.NEXT_PUBLIC_TEAM_SEATS || 10),
    large: process.env.NEXT_PUBLIC_PRICE_TEAM_LARGE || "299 €",
    largeSeats: Number(process.env.NEXT_PUBLIC_TEAM_SEATS_LARGE || 25),
  };
}
export function teamLinks(email?: string | null, userId?: string | null): { small: string | null; large: string | null } {
  const decorate = (base: string | undefined) => {
    if (!base) return null;
    const url = new URL(base);
    if (email) url.searchParams.set("prefilled_email", email);
    if (userId) url.searchParams.set("client_reference_id", userId);
    return url.toString();
  };
  return { small: decorate(process.env.STRIPE_LINK_TEAM_SMALL), large: decorate(process.env.STRIPE_LINK_TEAM_LARGE) };
}
