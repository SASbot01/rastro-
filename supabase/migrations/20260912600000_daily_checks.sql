-- Comprobación diaria barata (Pro con vigilancia): solo HIBP (brechas + pastes) por correo.
-- Una fila por usuario y día; alert = hay brechas o pastes nuevos respecto al día anterior / al último informe.
create table if not exists public.daily_checks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  day           date not null default current_date,
  breaches      int not null default 0,
  pastes        int not null default 0,
  new_breaches  jsonb not null default '[]'::jsonb,  -- nombres de brechas nuevas ese día
  new_pastes    int not null default 0,
  status        text not null default 'ok' check (status in ('ok','alert','error')),
  created_at    timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists daily_checks_user_day_idx on public.daily_checks (user_id, day desc);
alter table public.daily_checks enable row level security;
