-- Plan familiar: el titular (plan_kind='family') puede dar Pro a otras cuentas (plan_kind='member').
alter table public.users
  add column if not exists plan_kind text not null default 'individual' check (plan_kind in ('individual','family','member')),
  add column if not exists family_owner_id uuid references public.users(id) on delete set null;
create index if not exists users_family_owner_idx on public.users (family_owner_id) where family_owner_id is not null;
