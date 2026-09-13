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
