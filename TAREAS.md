# Tareas pendientes — Rastro

Estado a 10-09-2026. Producción: https://rastropro.com (servidor propio, ver README › Despliegue).

## Antes de abrir al público

- [ ] **Arranque automático tras reinicio** (servidor, con sudo, una vez):
      `sudo env PATH=$PATH:/usr/bin /home/s4sf/.npm-global/lib/node_modules/pm2/bin/pm2 startup systemd -u s4sf --hp /home/s4sf` y luego `pm2 save`.
- [ ] **Datos legales** en `/home/s4sf/rastro/.env.local`: `NEXT_PUBLIC_LEGAL_OWNER` (nombre real o empresa) y `NEXT_PUBLIC_LEGAL_EMAIL`. Después `pm2 restart rastro`. Hasta entonces las páginas legales muestran "[pendiente]".
- [ ] **Revisión legal profesional** de la política de privacidad, el aviso legal, la carta de supresión y el escrito de reclamación (son borradores serios, no revisados por un abogado).
- [ ] **Pruebas con 10 correos reales** (Día 6 del plan): pedir informes con gente de confianza y leerlos uno a uno.

## Stripe (plan Pro)

- [ ] **Rotar la `sk_live`** que se pegó en el chat (Stripe › Desarrolladores › Claves de API › Rotar) y ponerla en el servidor:
      `sed -i 's|^STRIPE_SECRET_KEY=.*|STRIPE_SECRET_KEY=sk_live_XXXX|' /home/s4sf/rastro/.env.local && /home/s4sf/.npm-global/bin/pm2 restart rastro`
      Sin ella el webhook no puede activar el plan Pro.
- [ ] **Rotar el `whsec`** (también pasó por el chat) y ponerlo con el mismo `sed` sobre `STRIPE_WEBHOOK_SECRET`. El destino de eventos debe apuntar a `https://rastropro.com/api/stripe/webhook`.
- [ ] Redirección tras el pago en los dos Payment Links → `https://rastropro.com/cuenta?pago=ok`.
- [ ] Portal del cliente activado en Stripe.
- [ ] Confirmar que `STRIPE_LINK_MONTHLY` es el enlace de 19 €/mes y `STRIPE_LINK_YEARLY` el de 99 €/año (si es al revés, intercambiarlos en `.env.local`).
- [ ] Probar un pago real (19 €, reembolsable) y comprobar que `/cuenta` pasa a "Plan Pro activo".

## Claves de API (decisión: rotar más adelante, todas a la vez)

Han pasado por el chat y por iCloud. Cuando toque, rotar y actualizar en `/home/s4sf/rastro/.env.local` (y en `.env.local` del Mac) + `pm2 restart rastro`:
- [ ] `ANTHROPIC_API_KEY`
- [ ] `PERPLEXITY_API_KEY`
- [ ] `BRAVE_API_KEY`
- [ ] `HIBP_API_KEY`
- [ ] `RESEND_API_KEY`

## Limpieza y repo

- [ ] `gh auth login` en el Mac y subir el repo a `github.com/SASbot01/rastro-` (remoto ya configurado; 20 commits en local).
- [ ] Borrar `~/Desktop/rastro` en el Mac (resto en iCloud; satura la sincronización).
- [ ] Borrar `support.rastropro.com` en Resend si se creó sin querer.
- [ ] Copias de seguridad de la base de datos del servidor (cron con `docker exec supabase_db_rastro pg_dump -U postgres postgres > backup.sql`).

## Mejoras propuestas (no empezadas)

- [ ] Paso "¿cuál de estos eres tú?" antes del informe (desambiguación de homónimos, cambio de flujo).
- [ ] Analítica: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=rastropro.com` si abres cuenta en Plausible.
- [ ] v2 del roadmap: simulador de ataque personal.
