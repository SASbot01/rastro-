import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { serverEnv, absoluteUrl } from "@/lib/env";

/** Portal de facturacion de Stripe (cambiar tarjeta, cancelar). POST desde /cuenta. */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(absoluteUrl("/entrar"), { status: 303 });
  const user = await findUserByEmail(session.email);
  if (!user?.stripe_customer_id) return NextResponse.redirect(absoluteUrl("/pro"), { status: 303 });

  try {
    const portal = await stripe().billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${serverEnv.siteUrl}/cuenta`,
    });
    return NextResponse.redirect(portal.url, { status: 303 });
  } catch (error) {
    console.error("[stripe] portal fallo:", error);
    return NextResponse.redirect(absoluteUrl("/cuenta"), { status: 303 });
  }
}
