import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/env";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { paymentLinks } from "@/lib/plan";
import { track } from "@/lib/events";

/** Paso intermedio hacia el pago: apunta el evento del embudo y redirige al enlace de Stripe (el correo nunca va en nuestra URL). */
export const runtime = "nodejs";

const PLANS = ["monthly", "yearly", "familyMonthly", "familyYearly", "launchYearly"] as const;

export async function GET(request: Request) {
  const plan = new URL(request.url).searchParams.get("plan") as (typeof PLANS)[number] | null;
  if (!plan || !PLANS.includes(plan)) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });
  const session = await getSession();
  const user = session ? await findUserByEmail(session.email) : null;
  const link = paymentLinks(user?.email ?? session?.email, user?.id)[plan];
  if (!link) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });
  await track("checkout_started", { subject: user?.id ?? null, locale: user?.locale ?? null, props: { plan, logged_in: Boolean(user) } });
  return NextResponse.redirect(link, { status: 303 });
}
