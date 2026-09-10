-- Día 10 (semana 2): cartas de supresión RGPD (art. 17).
create table if not exists public.letters (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  request_id    uuid references public.requests(id) on delete set null,
  finding_index int,
  host          text not null,               -- sitio destinatario (p. ej. spokeo.com)
  target_url    text not null,               -- dónde aparecen los datos
  contact       text,                        -- correo o URL de privacidad, si se encontró
  contact_source text,                       -- de dónde salió el contacto (URL) o null
  subject       text not null,
  body          text not null,
  locale        text not null default 'es',
  status        text not null default 'draft' check (status in ('draft','sent','answered','no_answer','closed')),
  sent_at       timestamptz,
  deadline_at   timestamptz,                 -- sent_at + 1 mes (art. 12.3)
  answered_at   timestamptz,
  reminded_at   timestamptz,                 -- último recordatorio enviado
  created_at    timestamptz not null default now()
);
create index if not exists letters_user_idx on public.letters (user_id, created_at desc);
create index if not exists letters_deadline_idx on public.letters (deadline_at) where status = 'sent';
alter table public.letters enable row level security;
