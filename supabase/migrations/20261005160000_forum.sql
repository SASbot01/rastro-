-- Comunidad / foro de ciberseguridad de Rastro. Publican las cuentas con sesión;
-- texto en plano; `hidden` para moderación; `official` para los hilos de Rastro.
create table if not exists public.forum_threads (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid references public.users(id) on delete set null,
  author_name      text,                       -- nombre mostrado (nunca el correo entero)
  official         boolean not null default false,
  tag              text not null default 'general',
  title            text not null,
  body             text not null,
  pinned           boolean not null default false,
  hidden           boolean not null default false,
  reply_count      int not null default 0,
  last_activity_at timestamptz not null default now(),
  ip_hash          text,
  created_at       timestamptz not null default now()
);
create index if not exists forum_threads_list_idx on public.forum_threads (hidden, pinned desc, last_activity_at desc);

create table if not exists public.forum_replies (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.forum_threads(id) on delete cascade,
  author_id   uuid references public.users(id) on delete set null,
  author_name text,
  official    boolean not null default false,
  body        text not null,
  hidden      boolean not null default false,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists forum_replies_thread_idx on public.forum_replies (thread_id, created_at);

create table if not exists public.forum_reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('thread','reply')),
  target_id   uuid not null,
  reporter_id uuid references public.users(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_reports enable row level security;

-- Suma una respuesta y refresca la actividad del hilo de forma atómica.
create or replace function public.bump_forum_thread(p_id uuid)
returns void language sql as $$
  update public.forum_threads set reply_count = reply_count + 1, last_activity_at = now() where id = p_id;
$$;
