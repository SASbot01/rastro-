-- Chat de la comunidad: mensajes publicos entre cuentas, con alias (nunca correo).
alter table public.users add column if not exists alias text;

create table if not exists public.community_messages (
  id         bigserial primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  alias      text not null,               -- alias en el momento de escribir
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  hidden     boolean not null default false  -- moderacion
);
create index if not exists community_messages_created_idx on public.community_messages (created_at desc);
alter table public.community_messages enable row level security;
