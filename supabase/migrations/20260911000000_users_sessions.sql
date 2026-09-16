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
