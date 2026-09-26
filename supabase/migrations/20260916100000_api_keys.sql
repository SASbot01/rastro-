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
