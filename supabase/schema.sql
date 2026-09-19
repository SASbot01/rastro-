-- Rastro — esquema inicial (Día 1)
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run.

create extension if not exists "pgcrypto";

-- =====================================================================
-- requests
-- =====================================================================
create table if not exists public.requests (
  id            uuid primary key default gen_random_uuid(),
  email         text        not null,
  full_name     text        not null,
  city          text,
  locale        text        not null default 'es' check (locale in ('es','en')),
  consent_at    timestamptz not null,
  verified_at   timestamptz,
  status        text        not null default 'pending'
                check (status in ('pending','verified','processing','done','error')),
  ip_hash       text        not null,

  -- Verificación por enlace (magic link propio, enviado con Resend)
  verify_token       text unique,
  verify_expires_at  timestamptz,

  -- Reservado para v1.5 (cuentas persistentes / suscripciones). Sin uso en v1.
  user_id       uuid references auth.users(id) on delete set null,

  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '30 days')
);

create index if not exists requests_email_idx      on public.requests (lower(email));
create index if not exists requests_status_idx     on public.requests (status);
create index if not exists requests_expires_at_idx on public.requests (expires_at);
create index if not exists requests_created_at_idx on public.requests (created_at desc);

-- =====================================================================
-- reports
-- =====================================================================
create table if not exists public.reports (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  score      int  not null check (score between 0 and 100),
  summary    text not null,
  findings   jsonb not null default '[]'::jsonb, -- [{category,title,detail,source_url,severity}]
  actions    jsonb not null default '[]'::jsonb, -- [{title,detail}]
  raw        jsonb,                              -- respuestas crudas; se borra con el informe
  created_at timestamptz not null default now()
);

create unique index if not exists reports_request_id_key on public.reports (request_id);

-- =====================================================================
-- rate_limits
-- =====================================================================
create table if not exists public.rate_limits (
  key          text primary key,   -- 'email:<hash>' | 'ip:<hash>'
  count        int  not null default 0,
  window_start timestamptz not null default now()
);

-- =====================================================================
-- RLS: nadie accede directamente. Todo pasa por el servidor con service_role,
-- que ignora RLS. Activar RLS sin políticas = denegado para anon/authenticated.
-- =====================================================================
alter table public.requests    enable row level security;
alter table public.reports     enable row level security;
alter table public.rate_limits enable row level security;

-- =====================================================================
-- Borrado automático a 30 días (se invoca desde un cron de Vercel en el Día 5)
-- =====================================================================
create or replace function public.purge_expired()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare deleted integer;
begin
  delete from public.requests where expires_at < now();
  get diagnostics deleted = row_count;   -- reports cae por on delete cascade
  return deleted;
end;
$$;
-- Día 2: estado del job asíncrono y desglose del score.

alter table public.requests
  add column if not exists step        text,          -- 'hibp' | 'brave' | 'ai' | 'report'
  add column if not exists error       text,
  add column if not exists started_at  timestamptz,
  add column if not exists finished_at timestamptz;

alter table public.reports
  add column if not exists breakdown jsonb not null default '{}'::jsonb; -- {rule: puntos}
-- Día 3: quién redactó el informe ('ai' = Anthropic; 'template' = plantillas de respaldo).
alter table public.reports
  add column if not exists generator text not null default 'template'
  check (generator in ('ai','template'));
-- Día 5: límite de uso atómico (una sola sentencia, sin carreras) y
-- índice para la caché por correo.

create or replace function public.bump_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else public.rate_limits.count + 1 end,
        window_start = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else public.rate_limits.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

create index if not exists requests_email_done_idx
  on public.requests (lower(email), created_at desc) where status = 'done';
-- Campo opcional "profesión o empresa": ancla la identidad frente a homónimos.
alter table public.requests add column if not exists occupation text;
-- Día 8 (semana 2): cuentas persistentes por enlace mágico.

create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,          -- siempre en minúsculas
  locale      text not null default 'es' check (locale in ('es','en')),
  plan        text not null default 'free' check (plan in ('free','pro')),
  plan_until  timestamptz,                    -- fin del periodo pagado (Stripe, más adelante)
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz
);

-- requests.user_id pasa a apuntar a nuestra tabla users (antes auth.users, sin uso).
alter table public.requests drop constraint if exists requests_user_id_fkey;
alter table public.requests
  add constraint requests_user_id_fkey foreign key (user_id) references public.users(id) on delete set null;
create index if not exists requests_user_id_idx on public.requests (user_id, created_at desc);

-- Enlaces de inicio de sesión (sin generar informe).
create table if not exists public.login_tokens (
  token_hash  text primary key,
  email       text not null,
  locale      text not null default 'es',
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.login_tokens enable row level security;

-- Los informes de una cuenta no caducan a los 30 días mientras la cuenta exista:
-- purge_expired solo borra solicitudes sin usuario.
create or replace function public.purge_expired()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare deleted integer;
begin
  delete from public.requests where expires_at < now() and user_id is null;
  get diagnostics deleted = row_count;
  delete from public.login_tokens where expires_at < now() - interval '1 day';
  return deleted;
end;
$$;
-- Día 9 (semana 2): monitorización mensual.
alter table public.users
  add column if not exists monitoring boolean not null default false,
  add column if not exists monitoring_consent_at timestamptz,
  add column if not exists monitor_last_at timestamptz;

-- Quién originó la solicitud: 'user' (formulario) o 'monitor' (cron mensual).
alter table public.requests
  add column if not exists origin text not null default 'user' check (origin in ('user','monitor'));

create index if not exists users_monitoring_due_idx on public.users (monitor_last_at) where monitoring;
-- Día 10 (semana 2): cartas de supresión RGPD (art. 17).
create table if not exists public.letters (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  request_id    uuid references public.requests(id) on delete set null,
  finding_index int,
  host          text not null,               -- sitio destinatario (p. ej. spokeo.com)
  target_url    text not null,               -- dónde aparecen los datos
  contact       text,                        -- correo o URL de privacidad, si se encontró
  contact_source text,                       -- de dónde salió el contacto (URL) o null
  subject       text not null,
  body          text not null,
  locale        text not null default 'es',
  status        text not null default 'draft' check (status in ('draft','sent','answered','no_answer','closed')),
  sent_at       timestamptz,
  deadline_at   timestamptz,                 -- sent_at + 1 mes (art. 12.3)
  answered_at   timestamptz,
  reminded_at   timestamptz,                 -- último recordatorio enviado
  created_at    timestamptz not null default now()
);
create index if not exists letters_user_idx on public.letters (user_id, created_at desc);
create index if not exists letters_deadline_idx on public.letters (deadline_at) where status = 'sent';
alter table public.letters enable row level security;
-- Día 13 (semana 2): plan Pro con Stripe.
alter table public.users
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan_status text;  -- estado bruto de Stripe (active, past_due, canceled...)

-- Eventos de webhook ya procesados (idempotencia).
create table if not exists public.stripe_events (
  id          text primary key,     -- evt_...
  type        text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- Permisos explícitos para service_role (el servidor de la app). En algunas
-- versiones de la CLI no vienen por defecto: sin esto, "permission denied".
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
-- Verificación por código de 6 dígitos (además del enlace): hash HMAC y contador de intentos.
alter table public.requests
  add column if not exists verify_code_hash text,
  add column if not exists verify_attempts int not null default 0;
-- Cuentas conocidas asociadas al correo (deducidas de filtraciones, pastes y Gravatar).
alter table public.reports add column if not exists accounts jsonb not null default '[]'::jsonb;
-- Escáner de buzón (Pro, beta): solo se guarda la lista de servicios deducida
-- de las cabeceras; nunca correos ni tokens.
create table if not exists public.mailbox_scans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  provider     text not null default 'google' check (provider in ('google')),
  mailbox      text not null,                       -- correo escaneado (puede ser distinto al de la cuenta)
  status       text not null default 'processing' check (status in ('processing','done','error')),
  step         text,                                -- 'listing' | 'headers' | 'grouping'
  messages_seen int not null default 0,
  services     jsonb not null default '[]'::jsonb,  -- [{domain, name, kind, first_seen, last_seen, messages, sample_subject}]
  error        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists mailbox_scans_user_idx on public.mailbox_scans (user_id, started_at desc);
alter table public.mailbox_scans enable row level security;

-- letters: una carta puede venir de un servicio del buzón (sin informe ni hallazgo)
alter table public.letters add column if not exists mailbox_scan_id uuid references public.mailbox_scans(id) on delete set null;
alter table public.mailbox_scans add column if not exists messages_total int;
-- Codigo de 6 digitos en los enlaces de acceso (misma credencial que el enlace).
alter table public.login_tokens
  add column if not exists code_hash text,
  add column if not exists attempts int not null default 0;
-- Chat de la comunidad: mensajes publicos entre cuentas, con alias (nunca correo).
alter table public.users add column if not exists alias text;

create table if not exists public.community_messages (
  id         bigserial primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  alias      text not null,               -- alias en el momento de escribir
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  hidden     boolean not null default false  -- moderacion
);
create index if not exists community_messages_created_idx on public.community_messages (created_at desc);
alter table public.community_messages enable row level security;
-- Comunidad retirada (decision del propietario, 10-09-2026).
drop table if exists public.community_messages;
alter table public.users drop column if exists alias;
-- Perfil editable: nombre para mostrar y foto (JPEG pequeno en data URL, <=120 KB).
alter table public.users
  add column if not exists display_name text,
  add column if not exists avatar text;
-- Comprobación diaria barata (Pro con vigilancia): solo HIBP (brechas + pastes) por correo.
-- Una fila por usuario y día; alert = hay brechas o pastes nuevos respecto al día anterior / al último informe.
create table if not exists public.daily_checks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  day           date not null default current_date,
  breaches      int not null default 0,
  pastes        int not null default 0,
  new_breaches  jsonb not null default '[]'::jsonb,  -- nombres de brechas nuevas ese día
  new_pastes    int not null default 0,
  status        text not null default 'ok' check (status in ('ok','alert','error')),
  created_at    timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists daily_checks_user_day_idx on public.daily_checks (user_id, day desc);
alter table public.daily_checks enable row level security;
-- Cartas RGPD enviadas por Rastro en nombre del usuario, con seguimiento.
alter table public.letters
  add column if not exists sent_via          text not null default 'user' check (sent_via in ('user','rastro')),
  add column if not exists message_id        text,                     -- id del correo en Resend
  add column if not exists follow_up_sent_at timestamptz,              -- segunda solicitud (día 20)
  add column if not exists reply_note        text,                     -- lo que contestó el sitio (pegado por el usuario)
  add column if not exists outcome           text check (outcome in ('deleted','refused','partial')),
  add column if not exists events            jsonb not null default '[]'::jsonb; -- cronología [{at,type,note,to}]
create index if not exists letters_follow_up_idx on public.letters (sent_at) where status = 'sent' and sent_via = 'rastro' and follow_up_sent_at is null;
-- Plan familiar: el titular (plan_kind='family') puede dar Pro a otras cuentas (plan_kind='member').
alter table public.users
  add column if not exists plan_kind text not null default 'individual' check (plan_kind in ('individual','family','member')),
  add column if not exists family_owner_id uuid references public.users(id) on delete set null;
create index if not exists users_family_owner_idx on public.users (family_owner_id) where family_owner_id is not null;
-- Comprobacion de resultado: ¿sigue apareciendo la persona en la URL de la carta?
alter table public.letters
  add column if not exists last_check_at timestamptz,
  add column if not exists still_listed boolean;
-- v2: simulador de ataque personal. Una simulacion por informe (se puede regenerar).
create table if not exists public.simulations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  request_id  uuid not null references public.requests(id) on delete cascade,
  content     jsonb not null,          -- {attackability, defenses, phishing[], vishing}
  model       text,
  sent_at     timestamptz,             -- cuando se enviaron los correos simulados al propio usuario
  created_at  timestamptz not null default now(),
  unique (user_id, request_id)
);
alter table public.simulations enable row level security;
-- v4: solicitudes de rectificacion/supresion a proveedores de IA (misma tabla que las cartas).
alter table public.letters
  add column if not exists kind text not null default 'site' check (kind in ('site','ai','image')),
  add column if not exists provider text;            -- 'openai' | 'gemini' | 'perplexity' | 'meta' | 'microsoft' (kind='ai')

-- v5: Rastro Equipos (B2B). Una organizacion con titular, plazas y miembros (users.org_id).
create table if not exists public.orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  seats         int not null default 10,
  created_at    timestamptz not null default now()
);
alter table public.orgs enable row level security;
alter table public.users
  add column if not exists org_id uuid references public.orgs(id) on delete set null,
  add column if not exists org_role text check (org_role in ('owner','member')),
  add column if not exists org_share_at timestamptz;  -- el miembro acepta compartir su puntuacion con la empresa
create index if not exists users_org_idx on public.users (org_id) where org_id is not null;
-- plan_kind admite 'team' (titular de empresa)
alter table public.users drop constraint if exists users_plan_kind_check;
alter table public.users add constraint users_plan_kind_check check (plan_kind in ('individual','family','member','team'));
-- API publica: claves por cuenta (solo se guarda el hash). Prefijo visible para identificarlas.
create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  name         text not null default 'default',
  prefix       text not null,                 -- primeros 12 caracteres, para mostrar
  key_hash     text not null unique,          -- sha256 de la clave completa
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists api_keys_user_idx on public.api_keys (user_id);
alter table public.api_keys enable row level security;

-- ===== 20260919100000_removals_ai_watch_events.sql =====
-- Bloque "de 8 a 10" (19-09-2026).
-- 1) Retiradas verificadas: fecha en la que comprobamos que el dato ya no aparece.
alter table public.letters
  add column if not exists removed_at  timestamptz,           -- primera comprobacion "ya no aparece" tras haber aparecido (o 404/410)
  add column if not exists check_count int not null default 0; -- comprobaciones automaticas + manuales
create index if not exists letters_recheck_idx on public.letters (last_check_at nulls first) where removed_at is null and status in ('sent','answered','no_answer');

-- 2) Memoria de lo que dice cada IA sobre la persona, para detectar cambios en el tiempo.
create table if not exists public.ai_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  request_id  uuid references public.requests(id) on delete set null,
  source      text not null default 'report' check (source in ('report','watch')),
  answers     jsonb not null,             -- [{provider, model, question, answer, sources[]}]
  facts       jsonb not null,             -- {provider: {knows_you, employer, city, contact[], claims[]}}
  changes     jsonb not null default '[]'::jsonb, -- [{provider, kind, before, after}] frente a la foto anterior
  taken_at    timestamptz not null default now()
);
create index if not exists ai_snapshots_user_idx on public.ai_snapshots (user_id, taken_at desc);
alter table public.ai_snapshots enable row level security;
alter table public.users add column if not exists ai_watch_last_at timestamptz;

-- 3) Metricas de producto propias: solo contadores de embudo. Sin IP, sin correo, sin cookies.
create table if not exists public.product_events (
  id      bigserial primary key,
  name    text not null,                  -- form_submitted, email_verified, report_ready, report_viewed, ...
  subject text,                           -- sha256 truncado de la solicitud o la cuenta (para contar unicos), nunca el id real
  locale  text,
  props   jsonb not null default '{}'::jsonb,
  at      timestamptz not null default now()
);
create index if not exists product_events_name_at_idx on public.product_events (name, at desc);
create index if not exists product_events_at_idx on public.product_events (at desc);
alter table public.product_events enable row level security;

-- 4) Comprobacion real de sitios del catalogo por persona (resultado por informe).
alter table public.reports add column if not exists site_checks jsonb; -- [{slug, host, status:'listed'|'not_found'|'unknown', url, title}]

-- Agregados del embudo (para /admin/metricas): totales y unicos por evento, y serie diaria.
create or replace function public.product_event_counts(since timestamptz)
returns table(name text, total bigint, uniques bigint) language sql stable as $$
  select e.name, count(*)::bigint, count(distinct coalesce(e.subject, e.id::text))::bigint
  from public.product_events e where e.at >= since group by e.name
$$;
create or replace function public.product_event_daily(since timestamptz)
returns table(day date, name text, total bigint) language sql stable as $$
  select (e.at at time zone 'Europe/Madrid')::date, e.name, count(*)::bigint
  from public.product_events e where e.at >= since group by 1, 2 order by 1
$$;
grant execute on all functions in schema public to service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
notify pgrst, 'reload schema';
