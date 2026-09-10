import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { serverEnv } from "@/lib/env";

/** Portal de facturacion de Stripe (cambiar tarjeta, cancelar). POST desde /cuenta. */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/entrar", origin), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user?.stripe_customer_id) return NextResponse.redirect(new URL("/pro", origin), { status: 303 });

  try {
    const portal = await stripe().billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${serverEnv.siteUrl}/cuenta`,
    });
    return NextResponse.redirect(portal.url, { status: 303 });
  } catch (error) {
    console.error("[stripe] portal fallo:", error);
    return NextResponse.redirect(new URL("/cuenta", origin), { status: 303 });
  }
}
