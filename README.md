# Rastro

**Mira lo que la IA sabe de ti.** — *See what AI knows about you.*

Informe gratuito de exposición personal: filtraciones, perfiles públicos y lo que responden los
asistentes de IA sobre ti, explicado en lenguaje llano y con una puntuación de 0 a 100.

El contexto completo del producto está en [`CLAUDE.md`](./CLAUDE.md). Este README es solo
para levantar el proyecto.

---

## Estado

**v1 completa (Días 1–7).** Formulario → verificación por correo → HIBP + Brave +
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

## Despliegue

### Vercel

1. Importa el repo en Vercel. Framework: Next.js (detección automática).
2. Pega todas las variables de `.env.example` en *Settings → Environment Variables*
   (con `NEXT_PUBLIC_SITE_URL=https://tudominio.com`).
3. El cron de borrado a 30 días ya está en `vercel.json` (04:00 UTC). Vercel envía
   `Authorization: Bearer $CRON_SECRET` automáticamente.
4. Dominio → verifícalo también en Resend y pon `RESEND_FROM` con él.

> El plan Hobby de Vercel prohíbe uso comercial: en cuanto cobres (semana 2) necesitas Pro.

### Servidor propio (Node 20+)

```bash
npm ci && npm run build
NODE_ENV=production PORT=3000 npm start
```

- Mantenlo vivo con `pm2` o un servicio `systemd`, detrás de un proxy con HTTPS (Caddy o nginx).
- Base de datos: tu Supabase autoalojado o cloud; aplica `supabase/schema.sql` una vez.
- Borrado a 30 días: un cron del sistema que llame al endpoint una vez al día:

```bash
0 4 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://tudominio.com/api/cron/purge
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
  api/cron/purge/route.ts     Borrado a 30 días (Bearer CRON_SECRET)
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
