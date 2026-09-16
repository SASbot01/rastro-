import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, syncSubscription } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { isLocale, type Locale } from "@/lib/i18n";

/**
 * Webhook de Stripe. Eventos que importan:
 *   checkout.session.completed      -> pago hecho: asocia cliente y activa Pro
 *   customer.subscription.updated   -> renovacion, cancelacion programada, impago
 *   customer.subscription.deleted   -> fin de la suscripcion
 * Firma verificada con STRIPE_WEBHOOK_SECRET; idempotente por id de evento.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new NextResponse("webhook no configurado", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    console.warn("[stripe] firma invalida:", error instanceof Error ? error.message : error);
    return new NextResponse("firma invalida", { status: 400 });
  }

  // Idempotencia: Stripe reintenta; un evento se procesa una sola vez.
  const { error: dup } = await supabaseAdmin().from("stripe_events").insert({ id: event.id, type: event.type });
  if (dup) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe().subscriptions.retrieve(subId);
        const locale: Locale = isLocale(session.locale) ? session.locale : "es";
        await syncSubscription(sub, {
          userId: session.client_reference_id,
          email: session.customer_details?.email ?? session.customer_email,
          locale,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub, {});
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[stripe] procesando", event.type, error);
    // 500 para que Stripe reintente; el registro de idempotencia se libera.
    await supabaseAdmin().from("stripe_events").delete().eq("id", event.id);
    return new NextResponse("error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
