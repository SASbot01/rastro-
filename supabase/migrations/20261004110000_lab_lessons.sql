-- Memoria del equipo de agentes: lecciones reutilizables (qué funcionó), por cuenta. Fase 2/"se automejora".
create table if not exists public.lab_lessons (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  service    text,
  tags       jsonb not null default '[]'::jsonb,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists lab_lessons_user_idx on public.lab_lessons (user_id, created_at desc);
alter table public.lab_lessons enable row level security;
grant all on all tables in schema public to service_role;
notify pgrst, 'reload schema';
