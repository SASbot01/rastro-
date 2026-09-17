# CLAUDE.md — RASTRO

Este archivo es el contexto completo del proyecto. Léelo entero antes de tocar nada.

> Actualización de experiencia 16-09-2026: la rama `codex/rastro-experience` añade revelación, stories, espejo, chat de IA, captura anónima, onboarding, ayuda urgente, tema claro, demo y extensión MVP. Ver `docs/EXPERIENCIA-RASTRO-2026.md` para alcance y pruebas. El brief del propietario de esa fecha amplía el antiguo alcance v1 que se conserva abajo como historial. Estos cambios no están publicados todavía.

## 1. Qué es Rastro

App web SaaS (bilingüe ES/EN desde el día 1) que responde a la pregunta: "¿qué sabe la IA de ti?"

- **Gratis:** el usuario mete nombre + correo → recibe un informe de exposición con score 0–100.
- **De pago (semana 2+, NO en la v1):** monitorización mensual, cartas de supresión RGPD generadas por IA, calendario de plazos y reclamación a la AEPD.

Cliente: personas normales, no técnicas. Se vende por Instagram, YouTube y LinkedIn con una cuenta propia de la app. El informe debe ser compartible: la gente hará captura y la subirá. Esa es la estrategia de crecimiento.

Lo construye una sola persona con Claude Code. Presupuesto de APIs: máximo 100 €/mes.

## 2. Decisiones ya tomadas (no discutir, ejecutar)

- Nombre provisional: **Rastro**. Eslogan: *"Mira lo que la IA sabe de ti."*
- Solo se puede pedir el informe sobre uno mismo. Verificación por enlace enviado al correo antes de mostrar el informe.
- Nunca prometemos "borrar". Prometemos visibilidad y herramientas.
- Estética (cambiada por el propietario el 10-09-2026): **oscura**, tarjetas con esquinas grandes, una tipografía (Inter), un solo acento vivo **verde `#4dfc5f`** (el del logo) para lo importante; semáforo verde / ámbar / rojo. Barra inferior en móvil con Inicio · Informe · Herramientas · Perfil. Sigue sin calaveras ni jerga hacker: el tono es limpio.
- Mobile first: el 90 % de tráfico vendrá de redes en móvil.
- Idioma por defecto según navegador; selector ES/EN visible.

## 3. Stack

- Next.js (App Router) + TypeScript + Tailwind.
- Supabase: Postgres + auth por magic link (verificación de correo).
- Vercel para el despliegue.
- Resend para correos transaccionales.
- Stripe (semana 2, no ahora).
- APIs de datos:
  - Have I Been Pwned (`HIBP_API_KEY`): brechas por correo.
  - Perplexity API (`PERPLEXITY_API_KEY`): "qué dice la IA de ti" con búsqueda web.
  - Brave Search API (`BRAVE_API_KEY`): perfiles públicos y resultados por nombre.
  - Anthropic API (`ANTHROPIC_API_KEY`): redactar el informe en lenguaje llano y calcular el score.
- Todas las claves en `.env.local`. Nunca en el código. Ver `.env.example`.

> **Desviaciones registradas:** registro/acceso con "Continuar con Google" (solo identidad) o correo con código de 6 dígitos, sin contraseñas. Cuentas por enlace mágico propio (cookie firmada con `APP_SECRET`, 30 días) en vez de Supabase Auth: mismo mecanismo que la verificación, sin SMTP extra ni dependencias, funciona en cualquier servidor. modelo por defecto `claude-sonnet-5` (Opus 5 supera el coste objetivo de 0,05 €/informe; cambiable con `ANTHROPIC_MODEL`). Solo puntúan los perfiles que la IA atribuye a la persona, no todos los homónimos que devuelve Brave. Supabase local con la CLI para desarrollo. Datos del responsable legal por variables de entorno.
>
> **Desviación registrada (Día 1):** `create-next-app@latest` instaló **Next 16.3.4**, no 15. Mismo App Router, mismo destino Vercel. Se mantiene 16 por ser la estable actual. Revertir con `npm i next@15 eslint-config-next@15` si hace falta.

## 4. Alcance de la v1 (UNA semana, sin excepciones)

### Qué SÍ

1. Landing con formulario (nombre, apellidos, correo, ciudad opcional, profesión/empresa opcional, checkbox de consentimiento).
2. Envío de magic link al correo. Sin él no hay informe.
3. Pipeline de informe (job asíncrono, máximo 90 s):
   - HIBP → lista de brechas (nombre, fecha, tipo de datos).
   - Brave → top 10 resultados por `"nombre apellidos"` (+ ciudad si la hay).
   - Perplexity → 3 preguntas: "¿Quién es X?", "¿Dónde trabaja y vive X?", "¿Qué datos de contacto de X hay públicos?".
   - Anthropic → a partir de todo lo anterior: score 0–100, resumen en lenguaje llano, lista de hallazgos clasificados (Filtraciones / Lo que dice la IA / Perfiles públicos / Datos posiblemente falsos), y 3 acciones recomendadas.
4. Página del informe: score grande, semáforo, secciones, botón "Compartir" que genera una imagen (OG image) con el score y el nombre tapado parcialmente.
5. Página de espera con progreso mientras se genera.
6. Aviso legal + política de privacidad (RGPD, base legal: consentimiento; retención 30 días; borrado automático).
7. Límite: 3 informes por correo y por día, 20 por IP.
8. Caché de resultados por correo durante 30 días (ahorro de API).

### Qué NO (semana 2 o después)

Pago, plan Pro, monitorización, cartas RGPD, panel de usuario, cuentas persistentes, app móvil, extensión.

**Coste objetivo:** < 0,05 € por informe.

## 5. Plan día a día

- **Día 1 ✅** — repo, Next.js + Tailwind + Supabase, `.env.example`, esquema de BD, landing estática con formulario funcionando (guarda en BD), magic link con Resend.
- **Día 2 ✅** — integración HIBP y Brave. Página de espera. Job asíncrono con estado en BD.
- **Día 3 ✅** — integración Perplexity y Anthropic. Prompt del informe y del score. Guardar el informe como JSON estructurado.
- **Día 4 ✅** — página del informe, diseño final, i18n ES/EN.
- **Día 5 ✅** — compartir (OG image), límites, caché, borrado automático a 30 días (cron de Vercel).
- **Día 6 ✅** — legal, textos, errores, casos raros (nombre común, sin resultados, HIBP vacío), pruebas con 10 correos reales.
- **Día 7 ✅** — despliegue en Vercel, dominio, analítica básica (Plausible o Vercel Analytics), revisión final.

### Semana 2 (v1.5) — estado

- **Día 8 ✅** cuentas por enlace mágico, sesión firmada, `/cuenta`, informe privado.
- **Día 9 ✅** vigilancia mensual (cron diario, diff determinista, correo solo con cambios).
- **Día 10 ✅** cartas de supresión RGPD (plantilla art. 17 + contacto de privacidad vía Perplexity).
- **Día 11 ✅** calendario de plazos y aviso de vencimiento.
- **Día 12 ✅** reclamación AEPD (escrito + guía).
- **Día 13 ✅** plan Pro con Stripe: Payment Links + webhook firmado e idempotente + portal; vigilancia, cartas y cron exigen Pro. Falta solo configurar en Stripe (clave rotada, webhook con dominio).
- Campo opcional "profesión o empresa" añadido para distinguir homónimos. **Ciudad obligatoria** desde el 13-09-2026 (homónimos).

### Bloque "de 6,5 a 9" (13-09-2026) — estado

- ✅ Cartas RGPD **enviadas por Rastro** (`cartas@rastropro.com`, reply-to y copia al usuario), recordatorio automático al día 20, respuesta del sitio con resultado, cronología como prueba, comprobación "¿sigue ahí?" y reclamación AEPD con todas las pruebas. Fuera de producción nunca se envían.
- ✅ **Catálogo de sitios** (`lib/brokers/catalog.ts`, 26 entradas: brokers españoles, guías, buscadores de personas de EE. UU., redes) con contacto y pasos; páginas públicas SEO `/sitios/[slug]`, sitemap y robots. Las cartas usan el catálogo antes que Perplexity.
- ✅ **IA en profundidad**: `lib/assistants.ts` (OpenAI y Gemini opcionales por clave), respuesta literal de cada IA en el informe con enlace de rectificación.
- ✅ **Plan familiar** (`plan_kind` family/member, `/api/family`, propagación desde Stripe) y precios por variables `NEXT_PUBLIC_PRICE_*`; enlaces `STRIPE_LINK_FAMILY_*` y `STRIPE_PRICE_IDS_FAMILY`.
- ✅ Robustez: `/api/health`, `deploy/backup.sh` (pg_dump diario, 14 días), `deploy/watchdog.sh` (pm2 cada 5 min), `push.sh` arranca pm2 si falta.
- ✅ Confianza: `/como-funciona`.
- ✅ **v2 simulador** (`/simulador`, `lib/ai/simulate.ts`, tabla `simulations`) y **v3 guardián** (`/guardian`, `lib/ai/guardian.ts`, Haiku 4.5, 5/día gratis por IP).
- ✅ **v4 identidad frente a la IA**: `lib/ai-providers.ts` (OpenAI, Gemini, Perplexity, Meta, Microsoft), `/api/ai-requests` (carta `kind='ai'` con la respuesta literal), `/imagenes` (Brave Images) con carta `kind='image'` (derecho a la propia imagen). Cara/voz clonadas: NO (sin proveedor con consentimiento verificado).
- ✅ **API pública v1** (16-09-2026): claves `rk_live_…` por cuenta (`api_keys`, hash sha256, máx. 5, revocables desde Perfil → API), `lib/api-auth.ts` (Bearer, límites 1000/día y 100/día para IA, CORS abierto, errores `{error:{code,message}}`), rutas `app/api/v1/*` (sites, ai-providers, score, letters/draft, guardian [Pro], me, me/reports[/latest], me/letters, me/checks), OpenAPI en `/api/v1/openapi.json` (fuente: `lib/api-spec.ts`) y docs en `/api-docs`. Regla: nunca datos de terceros.
- ✅ **Extensión Rastro Guardián 0.2** (18-09-2026, `extensions/guardian`): robot de cookies. `lib/analyze.js` (motor puro, nota 0–100, frases ES/EN, tests `tests/cookies.test.mjs`), `lib/trackers.js` (dominios y nombres de cookie → empresa/categoría), `mascot.js` (3 robots SVG arrastrables con física de péndulo; script clásico compartido con la web), `background.js`/`content.js`/`popup.*`. Sin llamadas de red (lo comprueba un test). Demo e instalación en `/extension`; `npm run ext:sync` copia el robot a `public/extension/` y genera el zip. Prueba real: `node scripts/test-extension.mjs <url>` (usa Brave: el Chrome de marca ya no acepta `--load-extension`).
- ✅ **Despliegue**: la app y el túnel corren bajo **systemd** (`rastro.service`, `rastro-tunnel.service`, Restart=always); pm2 ya no gestiona Rastro. `push.sh` reinicia matando el proceso del puerto 3000 (systemd lo relanza).
- ✅ **v5 Rastro Equipos**: tabla `orgs`, `users.org_id/org_role/org_share_at`, `plan_kind='team'`; `/equipos` (landing, precios `NEXT_PUBLIC_PRICE_TEAM_*`), `/equipo` (panel del titular), `/api/org*`; Stripe `STRIPE_PRICE_IDS_TEAM[_LARGE]` crea la org y propaga a miembros. La empresa solo ve puntuación/contraseñas filtradas/vigilancia si el empleado activa "compartir".

## 6. Modelo de datos (Supabase)

Ver `supabase/schema.sql` (fuente de verdad).

```
requests
  id uuid pk
  email text
  full_name text
  city text null
  locale text ('es'|'en')
  consent_at timestamptz
  verified_at timestamptz null
  status text ('pending'|'verified'|'processing'|'done'|'error')
  ip_hash text
  verify_token text null        -- añadido: SHA-256 del token del enlace
  verify_expires_at timestamptz -- añadido: caducidad del enlace (24 h)
  user_id uuid null             -- añadido: reservado para v1.5, sin uso en v1
  created_at timestamptz
  expires_at timestamptz        -- created_at + 30 días

reports
  id uuid pk
  request_id uuid fk
  score int
  summary text
  findings jsonb   -- [{category, title, detail, source_url, severity}]
  actions jsonb    -- [{title, detail}]
  raw jsonb        -- respuestas crudas de APIs (para depurar; se borra con el informe)
  created_at timestamptz

rate_limits
  key text pk   -- 'email:<hash>' o 'ip:<hash>'
  count int
  window_start timestamptz

users            -- semana 2: email único, plan ('free'|'pro'), plan_until, monitoring, monitor_last_at
login_tokens     -- enlaces de acceso de un solo uso (hash, correo, caducidad, used_at)
letters          -- cartas RGPD: sitio, URL, contacto, asunto, cuerpo, estado, sent_at, deadline_at, reminded_at
```

`purge_expired()` borra a los 30 días solo las solicitudes **sin cuenta**; con cuenta se conservan mientras exista.

RLS activado sin políticas en las tres tablas: solo el servidor entra, con `service_role`.

## 7. Score (regla inicial, ajustable)

Empieza en 100 y resta:

- Cada brecha con contraseña: −15 (máx. −45). Cada brecha sin contraseña: −5 (máx. −15).
- La IA acierta dónde trabajas: −10. Dónde vives (ciudad): −5. Teléfono o dirección públicos: −15.
- Cada perfil público con datos personales: −3 (máx. −15).
- Datos falsos sobre ti en la IA: −5 (es riesgo de reputación).

Mínimo 0. Semáforo: 70–100 verde, 40–69 naranja, 0–39 rojo.

## 8. Tono del informe

Lenguaje de persona normal, sin jerga. Cada hallazgo responde a tres cosas: **qué se ve, por qué importa, qué hacer.**

> "Tu correo apareció en la filtración de LinkedIn (2021) con contraseña. Si la sigues usando en algún sitio, cámbiala hoy."

Nunca alarmista, nunca vendedor.

## 9. Legal y privacidad (no negociable)

- Consentimiento explícito con checkbox y texto claro.
- Verificación de correo obligatoria antes de procesar.
- Retención 30 días, borrado automático de `requests` y `reports`.
- No enviar datos a APIs sin necesidad: a Perplexity/Brave solo nombre, ciudad y profesión/empresa (los dos últimos opcionales, añadidos tras la v1 para distinguir homónimos); a HIBP solo correo.
- Política de privacidad y aviso legal en ES y EN, responsable del tratamiento con nombre real, contacto para ejercer derechos.

## 10. Roadmap posterior (contexto, NO implementar ahora)

- **v1.5** (semana 2): plan Pro 19 €/mes / 99 €/año con Stripe: monitorización mensual, cartas de supresión RGPD, calendario de plazos, reclamación AEPD.
- **v2:** simulador de ataque personal (phishing a medida, guion de vishing, muestra de voz clonada, solo sobre uno mismo).
- **v3:** Guardián: extensión y bot que detectan fraude personalizado con IA.
- **v4:** identidad frente a la IA: monitorización de cara y voz, supresión y rectificación en OpenAI/Google/Meta.
- **v5:** Rastro Equipos (B2B pyme, 149–299 €/mes).
- **v6:** agente personal de seguridad que actúa solo.

Diseña la BD y el código pensando en que vendrán usuarios persistentes y suscripciones, pero no los construyas todavía.

## 11. Forma de trabajar con Claude Code

- Ve paso a paso: un día del plan cada vez. Al terminar cada día, resumen de 5 líneas de lo hecho y lo pendiente.
- Antes de instalar una dependencia nueva, dilo.
- Si una API falla o no tiene lo esperado, no inventes: dilo y propón alternativa.
- Commits pequeños con mensajes claros.
- Todo el texto visible en `messages/es.json` y `messages/en.json`, nunca hardcodeado.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
