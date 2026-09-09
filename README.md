# Rastro

**Mira lo que la IA sabe de ti.** — *See what AI knows about you.*

Informe gratuito de exposición personal: filtraciones, perfiles públicos y lo que responden los
asistentes de IA sobre ti, explicado en lenguaje llano y con una puntuación de 0 a 100.

El contexto completo del producto está en [`CLAUDE.md`](./CLAUDE.md). Este README es solo
para levantar el proyecto.

---

## Estado

**Día 1 de 7 completado.** Landing + formulario + verificación de correo por enlace.
La generación del informe llega en los Días 2–4.

## Requisitos

- Node.js 20 o superior (probado con 24.12)
- Una cuenta de [Supabase](https://supabase.com) (plan gratuito)
- Una cuenta de [Resend](https://resend.com) (plan gratuito)

## Puesta en marcha

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

### 2. Crea las tablas en Supabase

En el panel de Supabase: **SQL Editor → New query**, pega el contenido de
[`supabase/schema.sql`](./supabase/schema.sql) y ejecútalo.

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

Las claves de HIBP, Brave, Perplexity y Anthropic no hacen falta todavía (Días 2–3).

> En desarrollo, sin dominio propio, Resend solo entrega correo a la dirección con la que te
> registraste. Usa `RESEND_FROM="Rastro <onboarding@resend.dev>"` y prueba con ese correo.

## Estructura

```
app/
  page.tsx              Landing con el formulario
  verify/page.tsx       Consume el enlace del correo
  api/request/route.ts  Guarda la solicitud y envía el enlace
  privacidad/           Marcador de posición (Día 6)
  aviso-legal/          Marcador de posición (Día 6)
components/             Formulario, cabecera, pie, selector de idioma
lib/
  i18n.ts               Diccionarios y traductor
  locale.ts             Idioma efectivo (cookie > navegador)
  env.ts                Variables de entorno validadas
  supabase.ts           Cliente de servidor (service_role)
  crypto.ts             Hashes de IP/correo y tokens de un solo uso
  email.ts              Plantilla y envío con Resend
  validation.ts         Esquemas zod del formulario
messages/               es.json / en.json — TODO el texto visible
supabase/schema.sql     Esquema de la base de datos
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
