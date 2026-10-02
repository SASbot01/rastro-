-- Rastro Lab: cuaderno de laboratorios y bug bounty. Un espacio de trabajo (JSON) por cuenta, privado.
create table if not exists public.lab_workspaces (
  user_id    uuid primary key references public.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.lab_workspaces enable row level security;
grant all on all tables in schema public to service_role;
notify pgrst, 'reload schema';
