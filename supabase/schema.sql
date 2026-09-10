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
