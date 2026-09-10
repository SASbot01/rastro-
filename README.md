# Rastro

**Mira lo que la IA sabe de ti.** — *See what AI knows about you.*

Informe gratuito de exposición personal: filtraciones, perfiles públicos y lo que responden los
asistentes de IA sobre ti, explicado en lenguaje llano y con una puntuación de 0 a 100.

El contexto completo del producto está en [`CLAUDE.md`](./CLAUDE.md). Este README es solo
para levantar el proyecto.

---

## Estado

**v1 completa (Días 1–7) y semana 2 completa salvo el cobro (Días 8–12).** Cuentas por enlace
mágico, vigilancia mensual, cartas de supresión RGPD, calendario de plazos y reclamación AEPD.
Plan Pro con Stripe (Payment Links + webhook) construido; solo falta configurar claves y webhook en Stripe.

**v1 (Días 1–7).** Formulario → verificación por correo → HIBP + Brave +
Perplexity + Anthropic → informe con puntuación, hallazgos y acciones (ES/EN) →
imagen para compartir. Límites de uso, caché de 30 días, borrado automático y textos legales.

## Requisitos

- Node.js 20 o superior (probado con 24.12)
- Una cuenta de [Supabase](https://supabase.com) (plan gratuito)
- Una cuenta de [Resend](https://resend.com) (plan gratuito)

## Puesta en marcha (local)

```bash
npm install
cp .env.example .env.local
```

### 1. Rellena `.env.local`

Genera el secreto de la aplicación:

```bash
openssl rand -hex 32
```

Pégalo en `APP_SECRET`. Después completa las claves de Supabase y Resend (ver abajo).

### 2. Base de datos

**Opción A — Supabase local (sin cuenta, necesita Docker u OrbStack):**

```bash
supabase start && ./scripts/use-local-supabase.sh
```

Crea las tablas solo (migraciones en `supabase/migrations/`) y escribe las claves en `.env.local`.
Panel local: <http://127.0.0.1:54323>.

**Opción B — Supabase cloud:** en el panel, **SQL Editor → New query**, pega
[`supabase/schema.sql`](./supabase/schema.sql), ejecútalo y copia las claves de
*Project Settings → API* a `.env.local`.

### 3. Arranca

```bash
npm run dev
```

Abre <http://localhost:3000>.

## Dónde están las claves

| Variable | Dónde se saca |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role (**solo servidor**) |
| `RESEND_API_KEY` | Resend → API Keys |
| `RESEND_FROM` | Un remitente de un dominio verificado en Resend |
| `APP_SECRET` | `openssl rand -hex 32` |

| `HIBP_API_KEY` | haveibeenpwned.com/API/Key (suscripción, ~4 $/mes) |
| `BRAVE_API_KEY` | api-dashboard.search.brave.com |
| `PERPLEXITY_API_KEY` | perplexity.ai/settings/api |
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` por defecto (~0,05 $/informe); `claude-opus-5` si prefieres calidad sobre coste |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_LEGAL_OWNER` / `_LEGAL_EMAIL` / `_SITE_DOMAIN` | Responsable del tratamiento, contacto y dominio (aparecen en las páginas legales) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Opcional: dominio en Plausible para analítica sin cookies |

> **En desarrollo** el enlace de verificación siempre se imprime en la consola del servidor.
> Sin dominio verificado, Resend solo entrega a la dirección dueña de la cuenta; para enviar a
> cualquiera, verifica un dominio en resend.com/domains y pon `RESEND_FROM` con ese dominio.
> `RATE_LIMIT_DISABLED=1` salta los límites (3/correo, 20/IP al día) solo fuera de producción.

## Semana 2: cuentas y herramientas RGPD

| Función | Dónde | Cómo funciona |
| --- | --- | --- |
| Cuenta | `/verify`, `/entrar`, `/cuenta` | Verificar el correo crea la cuenta y una sesión de 30 días (cookie firmada con `APP_SECRET`). Entrar después: enlace de acceso de un solo uso. Sin contraseñas, sin Supabase Auth. |
| Informe privado | `/informe/[id]` | Solo la sesión del correo que lo pidió. La imagen compartible sigue siendo pública (nombre tapado). |
| Vigilancia mensual | `/cuenta` → `/api/monitor`, cron `/api/cron/monitor` | Cada día el cron regenera (sin caché) los informes con más de 30 días de quien la tenga activa, compara señales deterministas y envía correo solo si hay cambios. La IA recibe su valoración anterior para no cambiar de opinión sin evidencia. |
| Cartas RGPD | botón en cada hallazgo → `/cartas/[id]` | Plantilla legal fija (art. 17) con los datos del hallazgo; Perplexity busca el contacto de privacidad del sitio. Estados: borrador → enviada → contestada / sin respuesta. |
| Plazos | `/cuenta` y cron `/api/cron/letters` | "Ya la he enviado" fija el plazo a un mes (art. 12.3). Al vencer, correo con enlace a la carta. |
| Reclamación AEPD | `/cartas/[id]/reclamacion` | Escrito de reclamación (art. 77 RGPD) y guía de la sede electrónica, cuando pasa el mes sin respuesta. |

### Plan Pro (Stripe)

Las funciones de la tabla anterior son del plan Pro (19 €/mes o 99 €/año). El informe sigue siendo gratis.

- `/pro`: dos **Payment Links** de Stripe (`STRIPE_LINK_MONTHLY`, `STRIPE_LINK_YEARLY`) con el correo y la cuenta ya rellenados.
- `/api/stripe/webhook`: verifica la firma (`STRIPE_WEBHOOK_SECRET`), es idempotente (`stripe_events`) y traduce `checkout.session.completed` / `customer.subscription.updated|deleted` a `users.plan`, `plan_until` y `plan_status`. Si quien paga no tiene cuenta, la crea con el correo del pago.
- `/api/stripe/portal`: portal de facturación para cambiar tarjeta o cancelar (Pro sigue activo hasta el fin del periodo pagado).
- Cierre: activar vigilancia, generar cartas y el cron mensual exigen `isPro(user)`.

Configuración en Stripe: producto "Rastro Pro" con dos precios recurrentes; un Payment Link por precio con redirección tras el pago a `https://tudominio.com/cuenta?pago=ok`; endpoint de webhook `https://tudominio.com/api/stripe/webhook` con los tres eventos anteriores; portal del cliente activado. En local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

Los tres crons van en `vercel.json`; en servidor propio, tres líneas de cron llamando a
`/api/cron/purge`, `/api/cron/monitor` y `/api/cron/letters` con `Authorization: Bearer $CRON_SECRET`.
Coste de la vigilancia: ~0,05 $ por usuario y mes.

## Despliegue

### Vercel

1. Importa el repo en Vercel. Framework: Next.js (detección automática).
2. Pega todas las variables de `.env.example` en *Settings → Environment Variables*
   (con `NEXT_PUBLIC_SITE_URL=https://tudominio.com`).
3. El cron de borrado a 30 días ya está en `vercel.json` (04:00 UTC). Vercel envía
   `Authorization: Bearer $CRON_SECRET` automáticamente.
4. Dominio → verifícalo también en Resend y pon `RESEND_FROM` con él.

> El plan Hobby de Vercel prohíbe uso comercial: en cuanto cobres (semana 2) necesitas Pro.

### Servidor propio (Node 20+) — así está desplegado rastropro.com

Servidor `blackwolfsec-server` (Ubuntu 24.04, Tailscale `100.114.169.107`, usuario `s4sf`), sin sudo:

- Código en `~/rastro` (copiado con `rsync` desde el Mac; `npm install`, `npm run build`).
- Supabase propio con la CLI (`supabase start`), `project_id = rastro`, puertos **55321-55323** (otro proyecto usa 54321). Claves en `.env.local` vía `scripts/use-local-supabase.sh`.
- App con **pm2** (`~/.npm-global/bin/pm2`): `pm2 start deploy/ecosystem.config.cjs && pm2 save`; `pm2 startup` una vez con sudo.
- **Cloudflare Tunnel** con nombre `rastro` (`deploy/cloudflared.yml`), sin abrir puertos; HTTPS por Cloudflare. Los otros túneles del servidor son de tipo token y no se tocan.
- Cron: `deploy/crontab.txt` (líneas etiquetadas `# rastro`).
- Copias de seguridad: `docker exec supabase_db_rastro pg_dump -U postgres postgres > backup.sql`.

Receta genérica:

```bash
npm ci && npm run build
NODE_ENV=production PORT=3000 npm start
```

- Mantenlo vivo con `pm2` o un servicio `systemd`, detrás de un proxy con HTTPS (Caddy o nginx).
- Base de datos: tu Supabase autoalojado o cloud; aplica `supabase/schema.sql` una vez.
- Borrado a 30 días: un cron del sistema que llame al endpoint una vez al día:

```bash
0 4 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://tudominio.com/api/cron/purge
0 5 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://tudominio.com/api/cron/monitor
0 6 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://tudominio.com/api/cron/letters
```

- `after()` (el job del informe) funciona en `next start` sin configuración extra.

### Antes de abrir al público

- [ ] `NEXT_PUBLIC_LEGAL_OWNER`, `NEXT_PUBLIC_LEGAL_EMAIL` y `NEXT_PUBLIC_SITE_DOMAIN` rellenos: las páginas legales muestran "[pendiente]" hasta entonces.
- [ ] Textos legales revisados por un profesional.
- [ ] Dominio verificado en Resend y `RESEND_FROM` actualizado.
- [ ] `og.cta` en `messages/*.json` con tu dominio real (ahora dice `rastro.app`).
- [ ] Claves de API rotadas (las de desarrollo han pasado por chats y por iCloud).
- [ ] Prueba con 10 correos reales y revisa los informes uno a uno.

## Estructura

```
app/
  page.tsx                    Landing con el formulario
  verify/page.tsx             Consume el enlace, reclama la solicitud, lanza el job (after) y redirige
  informe/[id]/page.tsx       Espera con progreso real o informe final
  informe/[id]/imagen/        Imagen compartible (OG 1200x630, ?f=story 1080x1920)
  api/request/route.ts        Valida, aplica límites, guarda y envía el enlace
  api/report/[id]/route.ts    Estado del job para el polling
  api/cron/purge/route.ts     Borrado a 30 días de solicitudes sin cuenta (Bearer CRON_SECRET)
  api/cron/monitor/route.ts   Vigilancia mensual
  api/cron/letters/route.ts   Avisos de plazo vencido
  verify/route.ts             Consume el enlace, crea cuenta y sesión, lanza el job
  entrar/ cuenta/ cartas/     Acceso, cuenta (historial, vigilancia, cartas, plazos), cartas y reclamación AEPD
  api/login api/monitor api/letters api/session   Enlace de acceso, vigilancia, cartas, cierre de sesión
  api/dev/probe/route.ts      Solo desarrollo: prueba HIBP y Brave sin BD
  privacidad/ aviso-legal/    Textos legales
components/                   Formulario, espera, visor del informe, compartir, legal, cabecera/pie
lib/
  hibp.ts brave.ts perplexity.ts   Clientes de datos (cada uno recibe solo lo imprescindible)
  ai/report.ts                Anthropic: señales + redacción, salida validada con zod
  report/job.ts               Pipeline hibp → brave → ai → report, caché 30 días, fallback a plantillas
  report/score.ts             Reglas del score (CLAUDE.md §7), determinista y con desglose
  report/findings.ts          Plantillas de respaldo y señales para el score
  report/mask.ts              Nombre tapado para la imagen
  report/diff.ts              Diferencias deterministas entre informes (vigilancia)
  session.ts users.ts login-link.ts   Sesión firmada, cuentas, enlaces de acceso
  letters.ts                  Carta de supresión y escrito de reclamación (plantillas)
  rate-limit.ts               3/correo y 20/IP al día (RPC atómica)
  i18n.ts locale.ts env.ts supabase.ts crypto.ts email.ts validation.ts
messages/                     es.json / en.json — TODO el texto visible, mismas claves
supabase/
  schema.sql                  Esquema completo (para Supabase cloud)
  migrations/                 Lo mismo, troceado (para `supabase start`)
scripts/use-local-supabase.sh Vuelca las claves del Supabase local en .env.local
vercel.json                   Cron diario de borrado
```

## Comandos

```bash
npm run dev     # desarrollo
npm run build   # build de producción (incluye comprobación de tipos)
npm run lint    # eslint
```

## Idioma

El idioma sale de la cookie `rastro_locale` si existe; si no, de `Accept-Language`; si no,
español. El selector ES/EN de la cabecera fija la cookie.

Ningún texto visible se escribe en el código: todo vive en `messages/es.json` y
`messages/en.json`, y ambos ficheros tienen exactamente las mismas claves.
