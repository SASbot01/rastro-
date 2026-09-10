-- Escáner de buzón (Pro, beta): solo se guarda la lista de servicios deducida
-- de las cabeceras; nunca correos ni tokens.
create table if not exists public.mailbox_scans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  provider     text not null default 'google' check (provider in ('google')),
  mailbox      text not null,                       -- correo escaneado (puede ser distinto al de la cuenta)
  status       text not null default 'processing' check (status in ('processing','done','error')),
  step         text,                                -- 'listing' | 'headers' | 'grouping'
  messages_seen int not null default 0,
  services     jsonb not null default '[]'::jsonb,  -- [{domain, name, kind, first_seen, last_seen, messages, sample_subject}]
  error        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists mailbox_scans_user_idx on public.mailbox_scans (user_id, started_at desc);
alter table public.mailbox_scans enable row level security;

-- letters: una carta puede venir de un servicio del buzón (sin informe ni hallazgo)
alter table public.letters add column if not exists mailbox_scan_id uuid references public.mailbox_scans(id) on delete set null;
