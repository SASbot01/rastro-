-- Día 9 (semana 2): monitorización mensual.
alter table public.users
  add column if not exists monitoring boolean not null default false,
  add column if not exists monitoring_consent_at timestamptz,
  add column if not exists monitor_last_at timestamptz;

-- Quién originó la solicitud: 'user' (formulario) o 'monitor' (cron mensual).
alter table public.requests
  add column if not exists origin text not null default 'user' check (origin in ('user','monitor'));

create index if not exists users_monitoring_due_idx on public.users (monitor_last_at) where monitoring;
