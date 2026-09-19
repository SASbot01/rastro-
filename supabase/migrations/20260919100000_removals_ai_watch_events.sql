-- Bloque "de 8 a 10" (19-09-2026).
-- 1) Retiradas verificadas: fecha en la que comprobamos que el dato ya no aparece.
alter table public.letters
  add column if not exists removed_at  timestamptz,           -- primera comprobacion "ya no aparece" tras haber aparecido (o 404/410)
  add column if not exists check_count int not null default 0; -- comprobaciones automaticas + manuales
create index if not exists letters_recheck_idx on public.letters (last_check_at nulls first) where removed_at is null and status in ('sent','answered','no_answer');

-- 2) Memoria de lo que dice cada IA sobre la persona, para detectar cambios en el tiempo.
create table if not exists public.ai_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  request_id  uuid references public.requests(id) on delete set null,
  source      text not null default 'report' check (source in ('report','watch')),
  answers     jsonb not null,             -- [{provider, model, question, answer, sources[]}]
  facts       jsonb not null,             -- {provider: {knows_you, employer, city, contact[], claims[]}}
  changes     jsonb not null default '[]'::jsonb, -- [{provider, kind, before, after}] frente a la foto anterior
  taken_at    timestamptz not null default now()
);
create index if not exists ai_snapshots_user_idx on public.ai_snapshots (user_id, taken_at desc);
alter table public.ai_snapshots enable row level security;
alter table public.users add column if not exists ai_watch_last_at timestamptz;

-- 3) Metricas de producto propias: solo contadores de embudo. Sin IP, sin correo, sin cookies.
create table if not exists public.product_events (
  id      bigserial primary key,
  name    text not null,                  -- form_submitted, email_verified, report_ready, report_viewed, ...
  subject text,                           -- sha256 truncado de la solicitud o la cuenta (para contar unicos), nunca el id real
  locale  text,
  props   jsonb not null default '{}'::jsonb,
  at      timestamptz not null default now()
);
create index if not exists product_events_name_at_idx on public.product_events (name, at desc);
create index if not exists product_events_at_idx on public.product_events (at desc);
alter table public.product_events enable row level security;

-- 4) Comprobacion real de sitios del catalogo por persona (resultado por informe).
alter table public.reports add column if not exists site_checks jsonb; -- [{slug, host, status:'listed'|'not_found'|'unknown', url, title}]

-- Agregados del embudo (para /admin/metricas): totales y unicos por evento, y serie diaria.
create or replace function public.product_event_counts(since timestamptz)
returns table(name text, total bigint, uniques bigint) language sql stable as $$
  select e.name, count(*)::bigint, count(distinct coalesce(e.subject, e.id::text))::bigint
  from public.product_events e where e.at >= since group by e.name
$$;
create or replace function public.product_event_daily(since timestamptz)
returns table(day date, name text, total bigint) language sql stable as $$
  select (e.at at time zone 'Europe/Madrid')::date, e.name, count(*)::bigint
  from public.product_events e where e.at >= since group by 1, 2 order by 1
$$;
grant execute on all functions in schema public to service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
notify pgrst, 'reload schema';
