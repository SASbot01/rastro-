-- v2: simulador de ataque personal. Una simulacion por informe (se puede regenerar).
create table if not exists public.simulations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  request_id  uuid not null references public.requests(id) on delete cascade,
  content     jsonb not null,          -- {attackability, defenses, phishing[], vishing}
  model       text,
  sent_at     timestamptz,             -- cuando se enviaron los correos simulados al propio usuario
  created_at  timestamptz not null default now(),
  unique (user_id, request_id)
);
alter table public.simulations enable row level security;
