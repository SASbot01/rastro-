-- Solicitudes de acceso de empresas (Rastro Equipos). Las empresas no se dan de
-- alta solas: dejan sus datos de contacto y Rastro las aprueba y da de alta.
create table if not exists public.team_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,            -- persona de contacto
  company    text not null,
  role       text,                     -- cargo
  phone      text,                     -- teléfono de contacto
  email      text not null,
  seats      text,                     -- nº aproximado de personas
  message    text,
  status     text not null default 'new' check (status in ('new','contacted','closed')),
  ip_hash    text,
  created_at timestamptz not null default now()
);
alter table public.team_requests enable row level security;  -- solo el servidor
create index if not exists team_requests_new_idx on public.team_requests (status, created_at desc);
