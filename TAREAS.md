# Tareas pendientes — Rastro

Estado a 10-09-2026. Producción: https://rastropro.com (servidor propio, ver README › Despliegue).

## Antes de abrir al público

- [ ] **Arranque automático tras reinicio** (servidor, con sudo, una vez):
      `sudo env PATH=$PATH:/usr/bin /home/s4sf/.npm-global/lib/node_modules/pm2/bin/pm2 startup systemd -u s4sf --hp /home/s4sf` y luego `pm2 save`.
- [ ] **Datos legales** en `/home/s4sf/rastro/.env.local`: `NEXT_PUBLIC_LEGAL_OWNER` (nombre real o empresa) y `NEXT_PUBLIC_LEGAL_EMAIL`. Después `pm2 restart rastro`. Hasta entonces las páginas legales muestran "[pendiente]".
- [ ] **Revisión legal profesional** de la política de privacidad, el aviso legal, la carta de supresión y el escrito de reclamación (son borradores serios, no revisados por un abogado).
- [ ] **Pruebas con 10 correos reales** (Día 6 del plan): pedir informes con gente de confianza y leerlos uno a uno.

## Stripe (plan Pro)

- [x] `STRIPE_SECRET_KEY` puesta en el servidor (10-09-2026). Cobros y activación de Pro operativos.
- [ ] **ESTA NOCHE: rotar la `sk_live`** (pasó por el chat). Stripe › Desarrolladores › Claves de API › Rotar, y en el servidor:
      `sed -i 's|^STRIPE_SECRET_KEY=.*|STRIPE_SECRET_KEY=sk_live_NUEVA|' /home/s4sf/rastro/.env.local && /home/s4sf/.npm-global/bin/pm2 restart rastro`
- [x] Webhook `https://rastropro.com/api/stripe/webhook` con los 3 eventos: existe y está activo.
- [x] Enlaces: mensual = `…5kk0d` (19 €), anual = `…5kk0e` (99 €). Confirmado por la API.
- [x] Solo activan Pro los dos precios de Rastro (`STRIPE_PRICE_IDS`): la cuenta de Stripe se comparte con `soc.blackwolfsec.io` y `ryoiki`, y sus pagos se ignoran.
- [ ] **Rotar el `whsec`** (también pasó por el chat) y ponerlo con el mismo `sed` sobre `STRIPE_WEBHOOK_SECRET`. El destino de eventos debe apuntar a `https://rastropro.com/api/stripe/webhook`.
- [ ] Redirección tras el pago en los dos Payment Links → `https://rastropro.com/cuenta?pago=ok`.
- [ ] Portal del cliente activado en Stripe.
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

## Escáner de buzón (Gmail) — código desplegado, falta el proyecto de Google

- [ ] Google Cloud: proyecto "Rastro" → habilitar **Gmail API** → pantalla de consentimiento (Externa, en Pruebas; dominio `rastropro.com`, política `/privacidad`, condiciones `/aviso-legal`; scope `gmail.readonly`; **usuarios de prueba** hasta 100) → credencial OAuth "Aplicación web" con redirecciones `https://rastropro.com/api/google/callback` y `http://localhost:3000/api/google/callback`.
- [ ] Servidor: `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `/home/s4sf/rastro/.env.local` + `pm2 restart rastro`. Hasta entonces `/cuenta/buzon` dice "aún no está configurado".
- [ ] Probar con un buzón de prueba y ajustar heurísticas (dominios que salen mal agrupados, servicios que faltan).
- [ ] Cuando funcione comercialmente: verificación OAuth de Google + auditoría CASA nivel 2 (500–1.500 €/año) para pasar de 100 usuarios. Entonces, plan **Pro Total** (34 €/mes · 199 €/año) con escáner + re-escaneo mensual; ahora va incluido en Pro durante la beta.

## Mejoras propuestas (no empezadas)

- [ ] Paso "¿cuál de estos eres tú?" antes del informe (desambiguación de homónimos, cambio de flujo).
- [ ] Analítica: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=rastropro.com` si abres cuenta en Plausible.
- [ ] v2 del roadmap: simulador de ataque personal.
