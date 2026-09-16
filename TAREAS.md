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

- [x] Google Cloud: proyecto "Rastro" → habilitar **Gmail API** → pantalla de consentimiento (Externa, en Pruebas; dominio `rastropro.com`, política `/privacidad`, condiciones `/aviso-legal`; scope `gmail.readonly`; **usuarios de prueba** hasta 100) → credencial OAuth "Aplicación web" con redirecciones `https://rastropro.com/api/google/callback` y `http://localhost:3000/api/google/callback`.
- [x] Servidor: `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `/home/s4sf/rastro/.env.local` + `pm2 restart rastro`. Hasta entonces `/cuenta/buzon` dice "aún no está configurado".
- [ ] Probar con un buzón de prueba y ajustar heurísticas (dominios que salen mal agrupados, servicios que faltan).
- Estado real (10-09-2026): la app OAuth está **publicada sin verificar**. No hay lista de probadores: cualquiera puede conectar Gmail aceptando el aviso «app no verificada», pero hay un **tope de 100 personas para toda la vida del proyecto** (no se resetea; van 2). No abrir el escáner a mucha gente antes de verificar.
- [ ] Cuando funcione comercialmente: verificación OAuth de Google + auditoría CASA nivel 2 (500–1.500 €/año) para pasar de 100 usuarios. Entonces, plan **Pro Total** (34 €/mes · 199 €/año) con escáner + re-escaneo mensual; ahora va incluido en Pro durante la beta.

## Hecho el 10-09-2026 (tarde)

- [x] Rediseño oscuro con acento lima, barra inferior (móvil) / lateral (escritorio), 5 secciones: Inicio · Informe · Herramientas · Comunidad · Perfil.
- [x] Registro/acceso: "Continuar con Google" o correo con código de 6 dígitos (sin contraseñas). URI de redirección `https://rastropro.com/api/auth/google/callback` añadida (10-09-2026); comprobado que Google ya no devuelve `redirect_uri_mismatch`.
- [x] Informe en desplegables; IA con más espacio de salida y reintento (adiós "versión preliminar").
- [x] Chat de la comunidad con alias.

## Siguiente bloque acordado (10-09-2026)

- [ ] **Comprobación diaria + calendario semanal** en el perfil, al estilo de la referencia de UX (tira Lun–Dom con puntos): cada día se comprueba lo barato (HIBP: filtraciones y pastes nuevos; Gravatar) y una vez al mes lo caro (Brave + Perplexity + Anthropic). El calendario marca los días comprobados y los días con novedades; racha de días. Pro.

## Mejoras propuestas (no empezadas)

- [ ] Paso "¿cuál de estos eres tú?" antes del informe (desambiguación de homónimos, cambio de flujo).
- [ ] Analítica: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=rastropro.com` si abres cuenta en Plausible.
- [ ] v2 del roadmap: simulador de ataque personal.


## Hecho 11-09-2026
- [x] Informe: parseo propio con reparación de JSON, 3 intentos, sin hallazgos duplicados, ciudad/profesión mandan al atribuir perfiles. Cron `/api/cron/repair` (05:30) regenera con IA los informes que quedaron en plantilla (7 días), sin repetir búsquedas.
- [x] Comprobación diaria (`/api/cron/daily`, 07:00): HIBP brechas + pastes por correo para Pro con vigilancia; correo solo si hay algo nuevo. Tira semanal + racha en Perfil.
- [x] Analítica: soporte para Cloudflare Web Analytics (`NEXT_PUBLIC_CF_ANALYTICS_TOKEN`) además de Plausible. **Pendiente tuyo:** Cloudflare → Analytics & Logs → Web Analytics → añadir rastropro.com (automático al estar proxied) o pegar el token en el `.env.local` del servidor.

## v2 — Simulador de ataque personal (plan)
Objetivo: que la persona VEA cómo la atacarían con lo que ya es público de ella. Solo sobre uno mismo, con consentimiento explícito, sin enviar nada a terceros.
1. **Phishing a medida** (1 semana): a partir del informe (servicios donde tiene cuenta, filtraciones, ciudad, empleo) la IA redacta 3 correos de estafa personalizados (p. ej. «tu pedido de Amazon», «Hacienda», «tu banco») marcados como SIMULACIÓN, con las pistas para detectarlos señaladas. Se muestran en la web y, si el usuario quiere, se los enviamos a SU correo para vivir la experiencia. Gratis 1 muestra; Pro las 3 + envío.
2. **Guion de vishing** (3 días): guion de llamada telefónica que usaría un estafador con sus datos (nombre, empresa, ciudad, banco probable). Texto + audio con voz sintética neutra (TTS estándar, no clonada). Pro.
3. **Muestra de voz clonada** (1 semana, solo si hay proveedor con verificación de consentimiento, p. ej. ElevenLabs con «voice captcha»): el usuario graba 30 s, se genera 1 frase clonada y se borra el modelo al instante. Solo Pro y con doble consentimiento. Si no hay proveedor que exija verificación, NO se hace (riesgo legal y de abuso).
4. **Puntuación de «atacabilidad»** (2 días): 0–100 aparte del de exposición, con las 3 defensas que más la bajan (2FA, alias de correo, gestor de contraseñas).
5. **Compartible**: imagen «así me engañarían» para redes (sin datos personales), que es el gancho de crecimiento de la v2.
Coste estimado por usuario: < 0,10 € (IA) + TTS. No requiere APIs nuevas salvo el TTS/clonación.


## Bloque "de 6,5 a 9" (13-09-2026) — hecho y lo que queda de tu parte
Hecho: cartas enviadas por Rastro con seguimiento; catálogo de 26 sitios + páginas /sitios; ChatGPT/Gemini opcionales + respuesta literal; ciudad obligatoria; plan familiar; precios por env; health + backup diario + watchdog; /como-funciona; v2 simulador; v3 guardián.

Pendiente tuyo:
- [ ] **Claves de OpenAI y Gemini** (`OPENAI_API_KEY`, `GEMINI_API_KEY` en `/home/s4sf/rastro/.env.local` + `pm2 restart rastro`): sin ellas el informe solo consulta Perplexity (y lo dice).
- [ ] **Plan familiar en Stripe**: crea dos Payment Links (mensual/anual) y pon `STRIPE_LINK_FAMILY_MONTHLY`, `STRIPE_LINK_FAMILY_YEARLY`, `STRIPE_PRICE_IDS_FAMILY` (ids `price_...`) y los textos `NEXT_PUBLIC_PRICE_FAMILY_*`. Hasta entonces la tarjeta familiar no se muestra.
- [ ] **Precio Pro**: si bajas a 9,99/79 €, cambia los Payment Links en Stripe y `NEXT_PUBLIC_PRICE_MONTHLY/YEARLY`.
- [ ] **`sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u s4sf --hp /home/s4sf`** y luego `pm2 save`: el 11-09 el servidor se reinició y Rastro quedó fuera de pm2 (lo arrancó otro script); ahora está en pm2 y con watchdog, pero sin `startup` no vuelve solo tras un reinicio.
- [ ] Copias de seguridad fuera del servidor: `rsync -a 100.114.169.107:~/backups/rastro/ ~/backups-rastro/` desde tu Mac (o un cron).
- [ ] Cloudflare Web Analytics (Analytics & Logs → Web Analytics → añadir rastropro.com).
- [ ] Nombre del responsable legal (`NEXT_PUBLIC_LEGAL_OWNER/EMAIL`).

## v4 y v5 (13-09-2026) — hecho
- v4: solicitudes de rectificación a ChatGPT/Gemini/Perplexity/Meta/Copilot desde el informe (cartas kind='ai'); imágenes con tu nombre + carta de retirada.
- v5: Rastro Equipos (landing /equipos, panel /equipo, invitaciones, consentimiento del empleado, CSV, Stripe).
- [ ] **Stripe Equipos**: Payment Links y price ids → `STRIPE_LINK_TEAM_SMALL/LARGE`, `STRIPE_PRICE_IDS_TEAM[_LARGE]`. Sin ellos, la landing muestra "Hablar con nosotros" (soporte).
- [ ] Para probar un equipo sin Stripe: `update users set plan='pro', plan_until=now()+interval '1 year', plan_kind='team' where email='...'` y luego /equipo.
