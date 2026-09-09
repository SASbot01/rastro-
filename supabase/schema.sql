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
