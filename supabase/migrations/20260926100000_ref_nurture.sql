-- Origen del trafico (?ref=ig, tiktok, li...) por solicitud, para saber que contenido trae informes.
alter table public.requests add column if not exists ref text;
-- Secuencia de 3 correos tras el primer informe (dia 1, 3 y 7), por cuenta.
alter table public.users
  add column if not exists nurture_step    int not null default 0,   -- ultimo correo enviado (0-3)
  add column if not exists nurture_last_at timestamptz,
  add column if not exists nurture_opt_out boolean not null default false;
create index if not exists users_nurture_idx on public.users (nurture_step, nurture_last_at) where nurture_step < 3 and nurture_opt_out = false;
notify pgrst, 'reload schema';
