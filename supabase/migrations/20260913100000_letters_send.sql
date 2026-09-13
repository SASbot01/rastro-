-- Cartas RGPD enviadas por Rastro en nombre del usuario, con seguimiento.
alter table public.letters
  add column if not exists sent_via          text not null default 'user' check (sent_via in ('user','rastro')),
  add column if not exists message_id        text,                     -- id del correo en Resend
  add column if not exists follow_up_sent_at timestamptz,              -- segunda solicitud (día 20)
  add column if not exists reply_note        text,                     -- lo que contestó el sitio (pegado por el usuario)
  add column if not exists outcome           text check (outcome in ('deleted','refused','partial')),
  add column if not exists events            jsonb not null default '[]'::jsonb; -- cronología [{at,type,note,to}]
create index if not exists letters_follow_up_idx on public.letters (sent_at) where status = 'sent' and sent_via = 'rastro' and follow_up_sent_at is null;
